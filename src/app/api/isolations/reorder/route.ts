import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canMutateIsolationRecords } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'

export const runtime = 'nodejs'

type Mode = 'AUTO' | 'EMAIL' | 'PHONE'

function normalizeEmail(v: unknown) {
  if (typeof v !== 'string') return ''
  return v.trim().toLowerCase()
}

function normalizePhone(v: unknown) {
  if (typeof v !== 'string') return ''
  return v.replace(/\D/g, '')
}

function extractEmail(line: string) {
  const m = line.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  return m ? m[0] : ''
}

function extractPhone(line: string) {
  const digits = line.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateIsolationRecords(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureIsolationColumnsOnce()

  try {
    const body = (await request.json().catch(() => ({}))) as {
      radboox?: unknown
      lines?: unknown
      mode?: unknown
      appendUnlisted?: unknown
    }

    const radboox = typeof body.radboox === 'string' ? body.radboox.trim() : ''
    const linesRaw = body.lines
    const modeRaw = typeof body.mode === 'string' ? body.mode.trim().toUpperCase() : 'AUTO'
    const mode: Mode = modeRaw === 'EMAIL' || modeRaw === 'PHONE' || modeRaw === 'AUTO' ? (modeRaw as Mode) : 'AUTO'
    const appendUnlisted = body.appendUnlisted === true

    if (!radboox) {
      return NextResponse.json({ error: 'Radboox wajib dipilih' }, { status: 400 })
    }

    const lines =
      typeof linesRaw === 'string'
        ? linesRaw
            .split(/\r?\n/g)
            .map((x) => x.trim())
            .filter(Boolean)
        : []

    if (lines.length === 0) {
      return NextResponse.json({ error: 'Daftar urutan kosong' }, { status: 400 })
    }

    const rows = await (prisma as any).isolation.findMany({
      where: { radboox },
      select: { id: true, userEmail: true, customerPhone: true, sortIndex: true, activeDate: true, isolationDate: true },
    })

    const emailToId = new Map<string, number>()
    const phoneToId = new Map<string, number>()
    for (const r of rows as Array<{ id: number; userEmail?: string | null; customerPhone?: string | null }>) {
      const e = normalizeEmail(r.userEmail ?? '')
      if (e) emailToId.set(e, r.id)
      const p = normalizePhone(String(r.customerPhone ?? ''))
      if (p) phoneToId.set(p, r.id)
      const p62 = extractPhone(String(r.customerPhone ?? ''))
      if (p62) phoneToId.set(p62, r.id)
    }

    const target: Array<{ id: number; sortIndex: number }> = []
    const missing: string[] = []
    const seen = new Set<number>()

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      const email = extractEmail(line)
      const phone = extractPhone(line)

      let id: number | undefined
      if (mode === 'EMAIL') {
        if (email) id = emailToId.get(normalizeEmail(email))
      } else if (mode === 'PHONE') {
        if (phone) id = phoneToId.get(normalizePhone(phone)) ?? phoneToId.get(phone)
      } else {
        if (email) id = emailToId.get(normalizeEmail(email))
        if (!id && phone) id = phoneToId.get(normalizePhone(phone)) ?? phoneToId.get(phone)
      }

      if (!id) {
        missing.push(line)
        continue
      }
      if (seen.has(id)) continue
      seen.add(id)

      target.push({ id, sortIndex: (i + 1) * 10 })
    }

    const updates = target.map((t) =>
      (prisma as any).isolation.update({
        where: { id: t.id },
        data: { sortIndex: t.sortIndex },
      })
    )

    let appendUpdated = 0
    if (appendUnlisted) {
      const remaining = (rows as Array<any>)
        .filter((r) => !seen.has(r.id))
        .sort((a, b) => {
          const aSort = typeof a.sortIndex === 'number' ? a.sortIndex : Number.POSITIVE_INFINITY
          const bSort = typeof b.sortIndex === 'number' ? b.sortIndex : Number.POSITIVE_INFINITY
          if (aSort !== bSort) return aSort - bSort
          const aTime = a.activeDate ? new Date(a.activeDate).getTime() : 0
          const bTime = b.activeDate ? new Date(b.activeDate).getTime() : 0
          if (aTime !== bTime) return bTime - aTime
          return (typeof b.id === 'number' ? b.id : 0) - (typeof a.id === 'number' ? a.id : 0)
        })

      const start = (target.length + 1) * 10
      for (let j = 0; j < remaining.length; j += 1) {
        const r = remaining[j]
        updates.push(
          (prisma as any).isolation.update({
            where: { id: r.id },
            data: { sortIndex: start + j * 10 },
          })
        )
      }
      appendUpdated = remaining.length
    }

    await prisma.$transaction(updates)

    return NextResponse.json({
      success: true,
      updated: target.length,
      appended: appendUpdated,
      missingCount: missing.length,
      missing: missing.slice(0, 30),
    })
  } catch (error) {
    console.error('Failed to reorder isolations:', error)
    return NextResponse.json({ error: 'Gagal sync urutan' }, { status: 500 })
  }
}

