import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { canMutateMenu } from '@/lib/access'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'

export const runtime = 'nodejs'

function isMissingColumnError(e: unknown, column: string) {
  if (typeof e !== 'object' || !e) return false
  const anyErr = e as { code?: unknown; message?: unknown }
  const code = typeof anyErr.code === 'string' ? anyErr.code : ''
  const msg = typeof anyErr.message === 'string' ? anyErr.message : ''
  return code === 'P2022' && msg.toLowerCase().includes(column.toLowerCase())
}

type ImportRow = {
  isolationId?: unknown
  ticketDismantle?: unknown
  customerName?: unknown
  userEmail?: unknown
  customerPhone?: unknown
  activeDate?: unknown
  maps?: unknown
  address?: unknown
  reason?: unknown
  problem?: unknown
  marketing?: unknown
  radboox?: unknown
  status?: unknown
  suspend?: unknown
  isolationDate?: unknown
}

function normalizeHeader(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ')
    : ''
}

function mapField(key: string) {
  const normalized = normalizeHeader(key)
  if (['ID ISOLIR', 'ISOLATION ID', 'ID', 'ID DATA'].includes(normalized)) return 'isolationId'
  if (['NOMOR TICKET', 'TICKET DISMANTLE', 'TICKET', 'NO TICKET', 'NO TIKET', 'TIKET'].includes(normalized)) {
    return 'ticketDismantle'
  }
  if (['NAMA', 'NAMA PELANGGAN', 'CUSTOMER NAME'].includes(normalized)) return 'customerName'
  if (['USER', 'USER EMAIL', 'EMAIL', 'ID PELANGGAN'].includes(normalized)) return 'userEmail'
  if (['NO HP', 'NOHP', 'NO HP AKTIF', 'NO HANDPHONE', 'NO TELP', 'NO TELPON'].includes(normalized)) return 'customerPhone'
  if (['ACTIVE DATE', 'AKTIF', 'TANGGAL AKTIF', 'TGL AKTIF'].includes(normalized)) return 'activeDate'
  if (['MAPS', 'LINK MAPS', 'LOKASI MAPS', 'IN MAPS', 'MAP'].includes(normalized)) return 'maps'
  if (['ALAMAT', 'ADDRESS', 'ALAMAT PELANGGAN'].includes(normalized)) return 'address'
  if (['KETERANGAN', 'ALASAN', 'REASON', 'CATATAN'].includes(normalized)) return 'reason'
  if (['PROBLEM', 'MASALAH', 'DESKRIPSI'].includes(normalized)) return 'problem'
  if (['MARKETING', 'SALES', 'PIC MARKETING', 'PIC'].includes(normalized)) return 'marketing'
  if (['RADBOOX', 'RADBOX', 'RADBOOK'].includes(normalized)) return 'radboox'
  if (['STATUS', 'STATUS DATA', 'STATUS TICKET'].includes(normalized)) return 'status'
  if (['SUSPEND', 'LAMA SUSPEND', 'SUSPEND BULAN', 'SUSPEND (BULAN)'].includes(normalized)) return 'suspend'
  if (['TGL ISOLASI', 'TANGGAL ISOLASI', 'ISOLATION DATE'].includes(normalized)) return 'isolationDate'
  return ''
}

function normalizeOptionalString(value: unknown) {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized === '' ? null : normalized
}

function normalizeId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value.trim(), 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toImportRow(row: Record<string, unknown>) {
  const mapped: ImportRow = {}
  for (const [key, value] of Object.entries(row)) {
    const field = mapField(key)
    if (field) {
      ;(mapped as Record<string, unknown>)[field] = value
    }
  }
  return mapped
}

function parseDateValue(value: unknown) {
  if (value == null || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86400 * 1000))
  }

  const raw = String(value).trim()
  if (!raw) return null

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [, d, m, y] = slash
    return new Date(Number(y), Number(m) - 1, Number(d))
  }

  const dash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dash) {
    const [, d, m, y] = dash
    return new Date(Number(y), Number(m) - 1, Number(d))
  }

  const parsed = new Date(raw)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function deriveIsolationDate(suspendValue: unknown, isolationValue: unknown, activeValue: unknown) {
  const explicitIsolation = parseDateValue(isolationValue)
  if (explicitIsolation) return explicitIsolation

  const now = new Date()
  const suspendRaw = String(suspendValue ?? '').trim().toLowerCase()
  if (suspendRaw) {
    const monthsMatch = suspendRaw.match(/(\d+)\s*bulan/)
    const daysMatch = suspendRaw.match(/(\d+)\s*hari/)
    const months = monthsMatch ? Number.parseInt(monthsMatch[1], 10) : 0
    const days = daysMatch ? Number.parseInt(daysMatch[1], 10) : 0
    const derived = new Date(now)
    if (months > 0) derived.setMonth(derived.getMonth() - months)
    if (days > 0) derived.setDate(derived.getDate() - days)
    if (months > 0 || days > 0) return derived
  }

  const activeDate = parseDateValue(activeValue)
  if (activeDate) return activeDate

  const fallback = new Date(now)
  fallback.setMonth(fallback.getMonth() - 1)
  fallback.setDate(fallback.getDate() - 1)
  return fallback
}

function normalizeStatus(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase()
  if (!raw) return 'OPEN' as const
  if (['CLOSE', 'CLOSED', 'SELESAI', 'DONE'].includes(raw)) return 'CLOSED' as const
  return 'OPEN' as const
}

async function findExistingIsolationId(input: {
  isolationId: number | null
  customerName: string | null
  userEmail: string | null
  customerPhone: string | null
}) {
  if (input.isolationId != null) return input.isolationId

  if (input.userEmail) {
    const row = await prisma.isolation.findFirst({
      where: { userEmail: { equals: input.userEmail, mode: 'insensitive' } },
      select: { id: true },
      orderBy: { isolationDate: 'desc' },
    })
    if (row) return row.id
  }

  if (input.customerPhone) {
    const row = await prisma.isolation.findFirst({
      where: { customerPhone: input.customerPhone },
      select: { id: true },
      orderBy: { isolationDate: 'desc' },
    })
    if (row) return row.id
  }

  if (input.customerName) {
    const clauses: Prisma.IsolationWhereInput[] = [
      { customerName: { equals: input.customerName, mode: 'insensitive' } },
    ]
    if (input.userEmail) clauses.push({ userEmail: { equals: input.userEmail, mode: 'insensitive' } })
    if (input.customerPhone) clauses.push({ customerPhone: input.customerPhone })

    const row = await prisma.isolation.findFirst({
      where: { OR: clauses },
      select: { id: true },
      orderBy: { isolationDate: 'desc' },
    })
    if (row) return row.id
  }

  return null
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!canMutateMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await ensureIsolationColumnsOnce()
    const XLSX = await import('xlsx')
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File Excel tidak ditemukan' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

    let successCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = toImportRow(rawRow)
        const isolationId = normalizeId(row.isolationId)
        const ticketDismantle = normalizeOptionalString(row.ticketDismantle)
        const customerName = normalizeOptionalString(row.customerName)
        const userEmail = normalizeOptionalString(row.userEmail)
        const customerPhone = normalizeOptionalString(row.customerPhone)
        const activeDate = parseDateValue(row.activeDate)
        const customerAddress = normalizeOptionalString(row.address) ?? normalizeOptionalString(row.maps)
        const reason = normalizeOptionalString(row.reason)
        const problem = normalizeOptionalString(row.problem)
        const marketing = normalizeOptionalString(row.marketing)
        const radboox = normalizeOptionalString(row.radboox) ?? problem
        const status = normalizeStatus(row.status)
        const isolationDate = deriveIsolationDate(row.suspend, row.isolationDate, row.activeDate)

        if (isolationId == null && !customerName && !userEmail && !customerPhone) {
          continue
        }

        const targetId = await findExistingIsolationId({
          isolationId,
          customerName,
          userEmail,
          customerPhone,
        })

        if (targetId != null) {
          skippedCount += 1
          continue
        } else {
          if (!customerName) {
            throw new Error('Nama pelanggan wajib diisi untuk data baru')
          }

          const createData = {
            customerName,
            userEmail,
            customerPhone,
            activeDate,
            customerAddress,
            reason,
            marketing,
            radboox,
            sortIndex: (index + 1) * 10,
            status,
            isolationDate,
            restorationDate: status === 'CLOSED' ? new Date() : null,
            teknisi: session.user.name ?? null,
            ticketDismantle,
          } as const

          try {
            await prisma.isolation.create({ data: createData })
          } catch (e) {
            if (isMissingColumnError(e, 'closeNote') || isMissingColumnError(e, 'closePhoto') || isMissingColumnError(e, 'price') || isMissingColumnError(e, 'sortIndex')) {
              await ensureIsolationColumnsOnce()
              await prisma.isolation.create({ data: createData })
            } else {
              throw e
            }
          }
        }

        successCount += 1
      } catch (error) {
        errorCount += 1
        if (errors.length < 10) {
          const message = error instanceof Error ? error.message : String(error)
          errors.push(`Baris ${index + 2}: ${message}`)
        }
      }
    }

    cache.invalidateByPrefix('isolations:')
    return NextResponse.json({
      message: `Import selesai. Ditambahkan: ${successCount}, Diabaikan: ${skippedCount}, Gagal: ${errorCount}`,
      successCount,
      skippedCount,
      errorCount,
      errors,
    })
  } catch (error) {
    console.error('Dismantle import error:', error)
    return NextResponse.json({ error: 'Gagal memproses import Excel' }, { status: 500 })
  }
}
