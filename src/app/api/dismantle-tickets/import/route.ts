import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canMutateMenu } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'
import { ensureDismantleTicketsTable } from '@/lib/dismantle-tickets'

export const runtime = 'nodejs'

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
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : ''
}

function mapField(key: string) {
  const normalized = normalizeHeader(key)
  if (['ID ISOLIR', 'ISOLATION ID', 'ID', 'ID DATA'].includes(normalized)) return 'isolationId'
  if (['NOMOR TICKET', 'TICKET DISMANTLE', 'TICKET', 'NO TICKET', 'NO TIKET', 'TIKET'].includes(normalized)) return 'ticketDismantle'
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
    if (field) (mapped as any)[field] = value
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

async function findExistingIsolationId(input: { isolationId: number | null; userEmail: string | null; customerPhone: string | null; customerName: string | null }) {
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
    const row = await prisma.isolation.findFirst({
      where: { customerName: { equals: input.customerName, mode: 'insensitive' } },
      select: { id: true },
      orderBy: { isolationDate: 'desc' },
    })
    if (row) return row.id
  }

  return null
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canMutateMenu(session.user.role, 'dismantle')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureIsolationColumnsOnce()
  await ensureDismantleTicketsTable()

  try {
    const XLSX = await import('xlsx')
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File Excel tidak ditemukan' }, { status: 400 })

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
        const ticketNumber = normalizeOptionalString(row.ticketDismantle)
        const customerName = normalizeOptionalString(row.customerName)
        const userEmail = normalizeOptionalString(row.userEmail)
        const customerPhone = normalizeOptionalString(row.customerPhone)
        const activeDate = parseDateValue(row.activeDate)
        const customerAddress = normalizeOptionalString(row.address) ?? normalizeOptionalString(row.maps)
        const reason = normalizeOptionalString(row.reason)
        const problem = normalizeOptionalString(row.problem)
        const marketing = normalizeOptionalString(row.marketing)
        const radboox = normalizeOptionalString(row.radboox) ?? problem
        const isolationDate = deriveIsolationDate(row.suspend, row.isolationDate, activeDate)

        if (isolationId == null && !customerName && !userEmail && !customerPhone) {
          skippedCount += 1
          continue
        }

        const targetIsolationId = await findExistingIsolationId({
          isolationId,
          userEmail,
          customerPhone,
          customerName,
        })

        const now = new Date()
        if (targetIsolationId != null) {
          await prisma.$executeRawUnsafe(
            `
              INSERT INTO "DismantleTickets" (
                "sourceIsolationId","customerName","customerAddress","customerPhone","userEmail","marketing","radboox","isolationDate","reason","status","ticketNumber","createdAt","updatedAt"
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN',$10,$11,$11)
              ON CONFLICT ("sourceIsolationId") WHERE "sourceIsolationId" IS NOT NULL
              DO UPDATE SET
                "customerName" = EXCLUDED."customerName",
                "customerAddress" = EXCLUDED."customerAddress",
                "customerPhone" = EXCLUDED."customerPhone",
                "userEmail" = EXCLUDED."userEmail",
                "marketing" = EXCLUDED."marketing",
                "radboox" = EXCLUDED."radboox",
                "isolationDate" = EXCLUDED."isolationDate",
                "reason" = EXCLUDED."reason",
                "ticketNumber" = EXCLUDED."ticketNumber",
                "status" = 'OPEN',
                "updatedAt" = EXCLUDED."updatedAt"
            `,
            targetIsolationId,
            customerName ?? 'Unknown',
            customerAddress,
            customerPhone,
            userEmail,
            marketing,
            radboox,
            isolationDate,
            reason,
            ticketNumber,
            now,
          )
          await prisma.$executeRawUnsafe(`UPDATE "Isolation" SET "ticketDismantle" = NULL WHERE "id" = $1`, targetIsolationId).catch(() => {})
        } else {
          if (!customerName) {
            throw new Error('Nama pelanggan wajib diisi untuk data tanpa ID isolir')
          }
          await prisma.$executeRawUnsafe(
            `
              INSERT INTO "DismantleTickets" (
                "sourceIsolationId","customerName","customerAddress","customerPhone","userEmail","marketing","radboox","isolationDate","reason","status","ticketNumber","createdAt","updatedAt"
              ) VALUES (NULL,$1,$2,$3,$4,$5,$6,$7,$8,'OPEN',$9,$10,$10)
            `,
            customerName,
            customerAddress,
            customerPhone,
            userEmail,
            marketing,
            radboox,
            isolationDate,
            reason,
            ticketNumber,
            now,
          )
        }

        successCount += 1
      } catch (e) {
        errorCount += 1
        errors.push(`Row ${index + 1}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return NextResponse.json({
      message: `Import selesai. Berhasil: ${successCount}, Skip: ${skippedCount}, Error: ${errorCount}`,
      successCount,
      skippedCount,
      errorCount,
      errors,
    })
  } catch (error) {
    console.error('Failed to import dismantle tickets:', error)
    return NextResponse.json({ error: 'Gagal import Excel' }, { status: 500 })
  }
}
