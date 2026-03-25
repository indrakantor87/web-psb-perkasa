import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { ensureOdpTable } from '@/lib/odp-init'

export const runtime = 'nodejs'

function toInt(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : NaN
}

function normalizeStatusTiang(s: string) {
  const t = s.toLowerCase().replace(/\s+/g, '')
  if (t === 'na' || t === 'n/a') return 'n/a'
  if (t === 'perkasa') return 'Perkasa'
  if (t === 'numpang') return 'Numpang'
  return s
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureOdpTable()

  const { id } = await ctx.params
  const odpId = toInt(id)
  if (!Number.isFinite(odpId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const nama_odp = String(body?.nama_odp ?? '').trim()
  const wilayah = String(body?.wilayah ?? 'Pati').trim() || 'Pati'
  const lokasi = String(body?.lokasi ?? '').trim()
  const status_tiang = String(body?.status_tiang ?? 'Perkasa').trim() || 'Perkasa'
  const statusNorm = normalizeStatusTiang(status_tiang)
  const kapasitas = 8
  const terpakai = Math.trunc(Number(body?.terpakai ?? 0))

  if (!nama_odp) return NextResponse.json({ error: 'Nama ODP wajib diisi' }, { status: 400 })
  if (!wilayah) return NextResponse.json({ error: 'Wilayah wajib diisi' }, { status: 400 })
  if (!lokasi) return NextResponse.json({ error: 'Lokasi wajib diisi' }, { status: 400 })
  if (!Number.isFinite(terpakai) || terpakai < 0) return NextResponse.json({ error: 'Terpakai tidak valid' }, { status: 400 })
  if (terpakai > kapasitas) return NextResponse.json({ error: 'Terpakai melebihi kapasitas' }, { status: 400 })

  const conflict = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id
    FROM psb_odp
    WHERE is_active = TRUE
      AND id <> ${odpId}
      AND lower(nama_odp) = lower(${nama_odp})
      AND lower(wilayah) = lower(${wilayah})
    LIMIT 1
  `
  if (conflict[0]?.id) return NextResponse.json({ error: 'ODP sudah ada di POP tersebut' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE psb_odp
    SET nama_odp = ${nama_odp},
        wilayah = ${wilayah},
        lokasi = ${lokasi},
        kapasitas = ${kapasitas},
        terpakai = ${terpakai},
        status_tiang = ${statusNorm},
        updated_at = NOW()
    WHERE id = ${odpId} AND is_active = TRUE
  `

  cache.invalidateByPrefix('odp:')
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureOdpTable()

  const { id } = await ctx.params
  const odpId = toInt(id)
  if (!Number.isFinite(odpId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE psb_odp
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = ${odpId}
  `

  cache.invalidateByPrefix('odp:')
  return NextResponse.json({ ok: true })
}
