import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canMutateMenu } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleHistoryTable } from '@/lib/dismantle-history'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type ImportRow = {
  historyId?: unknown
  sourceIsolationId?: unknown
  ticketDismantle?: unknown
  customerName?: unknown
  userEmail?: unknown
  customerPhone?: unknown
  maps?: unknown
  customerAddress?: unknown
  reason?: unknown
  problem?: unknown
  closeNote?: unknown
  closedAt?: unknown
  closedBy?: unknown
  marketing?: unknown
  radboox?: unknown
}

function normalizeHeader(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ')
    : ''
}

function mapField(key: string) {
  const k = normalizeHeader(key)
  if (['ID HISTORI', 'ID HISTORY', 'HISTORY ID', 'ID'].includes(k)) return 'historyId'
  if (['REFERENSI ISOLIR', 'SOURCE ISOLATION ID', 'ID ISOLIR', 'ISOLATION ID'].includes(k)) return 'sourceIsolationId'
  if (['NOMOR TICKET', 'TICKET DISMANTLE', 'TICKET', 'NO TICKET', 'NO TIKET', 'TIKET'].includes(k)) return 'ticketDismantle'
  if (['NAMA', 'NAMA PELANGGAN', 'CUSTOMER NAME'].includes(k)) return 'customerName'
  if (['USER', 'USER EMAIL', 'EMAIL', 'ID PELANGGAN'].includes(k)) return 'userEmail'
  if (['NO HP', 'NOHP', 'NO HP AKTIF', 'NO HANDPHONE', 'NO TELP', 'NO TELPON'].includes(k)) return 'customerPhone'
  if (['MAPS', 'LINK MAPS', 'LOKASI MAPS', 'IN MAPS', 'MAP'].includes(k)) return 'maps'
  if (['ALAMAT', 'ADDRESS', 'ALAMAT PELANGGAN'].includes(k)) return 'customerAddress'
  if (['KETERANGAN', 'ALASAN', 'REASON', 'CATATAN'].includes(k)) return 'reason'
  if (['PROBLEM', 'MASALAH', 'DESKRIPSI'].includes(k)) return 'problem'
  if (['CLOSE NOTE', 'CATATAN CLOSE', 'CATATAN TUTUP', 'NOTE'].includes(k)) return 'closeNote'
  if (['DITUTUP PADA', 'CLOSED AT', 'CLOSE DATE', 'TANGGAL TUTUP'].includes(k)) return 'closedAt'
  if (['CLOSED BY', 'DITUTUP OLEH', 'CLOSE BY', 'PETUGAS'].includes(k)) return 'closedBy'
  if (['MARKETING', 'SALES', 'PIC MARKETING', 'PIC'].includes(k)) return 'marketing'
  if (['RADBOOX', 'RADBOX', 'RADBOOK'].includes(k)) return 'radboox'
  return ''
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

function parseDateTimeValue(value: unknown) {
  if (value == null || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86400 * 1000))
  }

  const raw = String(value).trim()
  if (!raw) return null

  const m1 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:.](\d{1,2}))?$/)
  if (m1) {
    const [, d, m, y, hh, mm] = m1
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      hh ? Number(hh) : 0,
      mm ? Number(mm) : 0,
      0,
      0,
    )
  }

  const m2 = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2})[:.](\d{1,2}))?$/)
  if (m2) {
    const [, d, m, y, hh, mm] = m2
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      hh ? Number(hh) : 0,
      mm ? Number(mm) : 0,
      0,
      0,
    )
  }

  const parsed = new Date(raw)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

async function findExistingHistoryIdByTicket(ticketDismantle: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
      SELECT "id"
      FROM "DismantleHistory"
      WHERE COALESCE(TRIM("ticketDismantle"), '') = $1
      ORDER BY "id" DESC
      LIMIT 1
    `,
    ticketDismantle.trim(),
  )
  const id = rows[0]?.id
  return typeof id === 'number' ? Number(id) : null
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureDismantleHistoryTable()

  try {
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

    let inserted = 0
    let updated = 0
    let skipped = 0
    let errorCount = 0
    const errors: string[] = []

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = toImportRow(rawRow)
        const historyId = normalizeId(row.historyId)
        const sourceIsolationId = normalizeId(row.sourceIsolationId)
        const ticketDismantle = normalizeOptionalString(row.ticketDismantle)
        const customerName = normalizeOptionalString(row.customerName)
        const userEmail = normalizeOptionalString(row.userEmail)
        const customerPhone = normalizeOptionalString(row.customerPhone)
        const marketing = normalizeOptionalString(row.marketing)
        const radboox = normalizeOptionalString(row.radboox)
        const ticketLocationMap = normalizeOptionalString(row.maps)
        const customerAddress = normalizeOptionalString(row.customerAddress)
        const reason = normalizeOptionalString(row.reason)
        const ticketDescription = normalizeOptionalString(row.problem)
        const closeNote = normalizeOptionalString(row.closeNote)
        const closedAt = parseDateTimeValue(row.closedAt) ?? new Date()
        const closedBy = normalizeOptionalString(row.closedBy) ?? (session.user.name ?? null)

        if (!ticketDismantle) {
          skipped += 1
          continue
        }

        const targetId =
          historyId != null ? historyId : await findExistingHistoryIdByTicket(ticketDismantle)

        if (targetId != null) {
          await prisma.$executeRawUnsafe(
            `
              UPDATE "DismantleHistory"
              SET
                "sourceIsolationId" = $2,
                "customerName" = COALESCE($3, "customerName"),
                "customerAddress" = $4,
                "customerPhone" = $5,
                "userEmail" = $6,
                "marketing" = $7,
                "radboox" = $8,
                "reason" = $9,
                "ticketDismantle" = $10,
                "ticketLocationMap" = $11,
                "ticketDescription" = $12,
                "closeNote" = $13,
                "closedAt" = $14,
                "closedBy" = $15,
                "updatedAt" = CURRENT_TIMESTAMP
              WHERE "id" = $1
            `,
            targetId,
            sourceIsolationId,
            customerName,
            customerAddress,
            customerPhone,
            userEmail,
            marketing,
            radboox,
            reason,
            ticketDismantle,
            ticketLocationMap,
            ticketDescription,
            closeNote,
            closedAt,
            closedBy,
          )
          updated += 1
        } else {
          if (!customerName) {
            throw new Error('Nama pelanggan wajib diisi untuk data baru')
          }

          await prisma.$executeRawUnsafe(
            `
              INSERT INTO "DismantleHistory" (
                "sourceIsolationId",
                "customerName",
                "customerAddress",
                "customerPhone",
                "userEmail",
                "marketing",
                "radboox",
                "isolationDate",
                "reason",
                "ticketDismantle",
                "ticketId",
                "ticketLocationMap",
                "ticketDescription",
                "closeNote",
                "closePhoto",
                "closedAt",
                "closedBy",
                "createdAt",
                "updatedAt"
              ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
              )
            `,
            sourceIsolationId,
            customerName,
            customerAddress,
            customerPhone,
            userEmail,
            marketing,
            radboox,
            closedAt,
            reason,
            ticketDismantle,
            null,
            ticketLocationMap,
            ticketDescription,
            closeNote,
            null,
            closedAt,
            closedBy,
            new Date(),
            new Date(),
          )
          inserted += 1
        }
      } catch (error) {
        errorCount += 1
        if (errors.length < 10) {
          const message = error instanceof Error ? error.message : String(error)
          errors.push(`Baris ${index + 2}: ${message}`)
        }
      }
    }

    return NextResponse.json({
      message: `Import selesai. Ditambahkan: ${inserted}, Diupdate: ${updated}, Dilewati: ${skipped}, Gagal: ${errorCount}`,
      inserted,
      updated,
      skipped,
      errorCount,
      errors,
    })
  } catch (error) {
    console.error('Dismantle close import error:', error)
    return NextResponse.json({ error: 'Gagal memproses import Excel' }, { status: 500 })
  }
}

