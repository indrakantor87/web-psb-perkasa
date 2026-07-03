import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'

export const runtime = 'nodejs'

type ImportRow = {
  isolationId?: unknown
  ticketDismantle?: unknown
  customerName?: unknown
  userEmail?: unknown
  customerPhone?: unknown
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

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!['ADMIN', 'CS', 'NOC', 'DISMANTLE'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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

    let successCount = 0
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

        if (isolationId == null && !customerName && !userEmail && !customerPhone) {
          continue
        }

        let targetId: number | null = isolationId

        if (targetId == null) {
          const clauses: Prisma.IsolationWhereInput[] = []
          if (customerName) {
            clauses.push({ customerName: { equals: customerName, mode: 'insensitive' } })
          }
          if (userEmail) {
            clauses.push({ userEmail: { equals: userEmail, mode: 'insensitive' } })
          }
          if (customerPhone) {
            clauses.push({ customerPhone: { equals: customerPhone } })
          }

          if (clauses.length === 0) {
            throw new Error('Data pencocokan tidak lengkap')
          }

          const matches = await prisma.isolation.findMany({
            where: { AND: clauses },
            select: { id: true },
            orderBy: { isolationDate: 'desc' },
            take: 2,
          })

          if (matches.length === 0) {
            throw new Error('Data isolir tidak ditemukan')
          }
          if (matches.length > 1) {
            throw new Error('Data ganda ditemukan, gunakan kolom ID Isolir')
          }

          targetId = matches[0].id
        }

        await prisma.isolation.update({
          where: { id: targetId },
          data: { ticketDismantle },
        })

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
      message: `Import selesai. Berhasil: ${successCount}, Gagal: ${errorCount}`,
      successCount,
      errorCount,
      errors,
    })
  } catch (error) {
    console.error('Dismantle import error:', error)
    return NextResponse.json({ error: 'Gagal memproses import Excel' }, { status: 500 })
  }
}
