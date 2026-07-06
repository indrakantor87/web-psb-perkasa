import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'
import { canMutateIsolationRecords } from '@/lib/access'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'
// Avoid bundling issues on Vercel by dynamically importing 'xlsx'

export const runtime = 'nodejs'

// Helper to parse DD/MM/YYYY or Excel serial date
function parseDate(dateStr: string | number): Date | null {
  if (!dateStr) return null
  
  // Handle Excel serial date number
  if (typeof dateStr === 'number') {
    // Excel base date is 1899-12-30. JS is 1970-01-01.
    // Excel serial 1 = 1900-01-01 (but Excel thinks 1900 is leap year, bug)
    // 25569 is diff between 1970-01-01 and 1900-01-01
    return new Date(Math.round((dateStr - 25569) * 86400 * 1000))
  }

  if (typeof dateStr === 'string') {
    // Try DD/MM/YYYY
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const year = parseInt(parts[2], 10)
      return new Date(year, month, day)
    }
  }
  
  return new Date(dateStr)
}

function parsePrice(value: unknown): Prisma.Decimal | null {
  if (value == null) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return new Prisma.Decimal(value)
  }
  if (typeof value === 'bigint') return new Prisma.Decimal(value.toString())
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (!raw) return null

  const cleaned = raw
    .replace(/rp/gi, '')
    .replace(/\s+/g, '')
    .replace(/[^\d.,-]/g, '')

  if (!cleaned) return null

  const hasComma = cleaned.includes(',')
  const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/\./g, '')
  const num = parseFloat(normalized)
  if (Number.isNaN(num) || !Number.isFinite(num)) return null
  return new Prisma.Decimal(num)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!canMutateIsolationRecords(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  try {
    await ensureIsolationColumnsOnce()

    const XLSX = await import('xlsx')
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

    let successCount = 0
    let errorCount = 0
    const errorDetails: string[] = []

    // Use transaction or createMany? 
    // createMany is faster but strict. Loop allows error handling per row.
    // Given the scale is likely small (hundreds), loop is fine.

    // Header normalization helpers
    const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : '')
    const mapField = (key: string) => {
      const k = norm(key)
      if (['NAMA PELANGGAN', 'NAMA', 'CUSTOMER', 'PELAGGAN', 'CUSTOMER NAME'].includes(k)) return 'customerName'
      if (['USER', 'EMAIL', 'ID PELANGGAN', 'USER EMAIL'].includes(k)) return 'userEmail'
      if (['NO HP', 'NOHP', 'NO TELP', 'NO TELPON', 'NO HP AKTIF', 'NOHP AKTIF', 'NO HP PELANGGAN', 'NO HP PEL'].includes(k)) return 'customerPhone'
      if (['ACTIVE DATE', 'AKTIF', 'TANGGAL AKTIF', 'TGL AKTIF', 'START DATE', 'AKTIVE DATE'].includes(k)) return 'activeDate'
      if (['MAPS', 'MAPS LOKASI', 'LOKASI MAPS', 'LINK MAPS', 'IN MAPS', 'MAP'].includes(k)) return 'customerAddress'
      if (['KETERANGAN', 'ALASAN', 'REASON', 'CATATAN'].includes(k)) return 'reason'
      if (['MARKETING', 'SALES', 'PIC MARKETING', 'PIC'].includes(k)) return 'marketing'
      if (['RADBOOX', 'RADBOX', 'RADBOOK', 'RADBOOX AREA'].includes(k)) return 'radboox'
      if (['TGL ISOLASI', 'TANGGAL ISOLASI', 'ISOLATION DATE', 'TGL SUSPEND', 'TANGGAL SUSPEND'].includes(k)) return 'isolationDate'
      if (['TGL RESTORASI', 'TANGGAL RESTORASI', 'RESTORATION DATE', 'TGL NORMAL', 'TANGGAL NORMAL'].includes(k)) return 'restorationDate'
      if (['SUSPEND', 'SUSPEND BULAN', 'SUSPEND (BULAN)', 'LAMA SUSPEND', 'LAMA SUSPEND (BULAN)'].includes(k)) return 'suspendMonths'
      if (['NOMOR TICKET', 'NOMOR TIKET', 'NO TICKET', 'NO TIKET', 'TICKET DISMANTLE', 'NOMOR TICKET DISMANTLE', 'NOMOR TIKET DISMANTLE'].includes(k)) return 'ticketDismantle'
      if (['TICKET', 'TIKET', 'STATUS TICKET', 'STATUS'].includes(k)) return 'status'
      if (['HARGA', 'PRICE', 'BIAYA', 'TARIF', 'HARGA PAKET'].includes(k)) return 'price'
      return ''
    }

    type IsoRow = {
      customerName?: unknown
      userEmail?: unknown
      customerPhone?: unknown
      activeDate?: unknown
      customerAddress?: unknown
      reason?: unknown
      marketing?: unknown
      radboox?: unknown
      isolationDate?: unknown
      restorationDate?: unknown
      suspendMonths?: unknown
      ticketDismantle?: unknown
      price?: unknown
      status?: unknown
    }

    const toIsoRow = (row: Record<string, unknown>): IsoRow => {
      const out: IsoRow = {}
      for (const [k, v] of Object.entries(row)) {
        const f = mapField(k)
        if (f) (out as Record<string, unknown>)[f] = v
      }
      return out
    }

    const toCreate: any[] = []

    for (const [idx, row] of jsonData.entries()) {
      const r = toIsoRow(row)
      const customerName = r.customerName
      if (!customerName) { continue }
      try {
        const customerNameStr = String(customerName)
        const userEmail = r.userEmail ? String(r.userEmail) : null
        const customerPhone = r.customerPhone ? String(r.customerPhone) : null
        const activeDateRaw = r.activeDate
        const activeDate = parseDate(typeof activeDateRaw === 'number' || typeof activeDateRaw === 'string' ? activeDateRaw : String(activeDateRaw ?? ''))
        const customerAddress = r.customerAddress ? String(r.customerAddress) : null
        const reason = r.reason ? String(r.reason) : null
        const marketing = r.marketing ? String(r.marketing) : null
        const radboox = r.radboox ? String(r.radboox) : null
        const price = parsePrice(r.price)
        const statusRaw = typeof r.status === 'string' || typeof r.status === 'number' ? String(r.status) : ''
        const statusNorm = statusRaw.trim().toUpperCase()
        const isoDateRaw = r.isolationDate
        const isoDateParsed = parseDate(typeof isoDateRaw === 'number' || typeof isoDateRaw === 'string' ? isoDateRaw : String(isoDateRaw ?? ''))
        const restorationRaw = r.restorationDate
        const restorationDate = parseDate(typeof restorationRaw === 'number' || typeof restorationRaw === 'string' ? restorationRaw : String(restorationRaw ?? ''))
        const suspendMonthsRaw = r.suspendMonths
        const suspendMonthsNum =
          typeof suspendMonthsRaw === 'number'
            ? Math.trunc(suspendMonthsRaw)
            : typeof suspendMonthsRaw === 'string'
              ? Math.trunc(parseInt(suspendMonthsRaw, 10))
              : NaN

        const isolationDate =
          isoDateParsed && !Number.isNaN(isoDateParsed.getTime())
            ? isoDateParsed
            : Number.isFinite(suspendMonthsNum) && suspendMonthsNum > 0
              ? new Date(new Date().getFullYear(), new Date().getMonth() - suspendMonthsNum, 1)
              : new Date()

        const ticketDismantleRaw = r.ticketDismantle
        const ticketDismantle =
          typeof ticketDismantleRaw === 'string'
            ? ticketDismantleRaw.trim() === ''
              ? null
              : ticketDismantleRaw.trim()
            : typeof ticketDismantleRaw === 'number'
              ? String(ticketDismantleRaw)
              : ticketDismantleRaw == null
                ? null
                : String(ticketDismantleRaw).trim() === ''
                  ? null
                  : String(ticketDismantleRaw).trim()

        const isClosedFromStatus =
          statusNorm === 'CLOSE' ||
          statusNorm === 'CLOSED' ||
          statusNorm === 'SELESAI' ||
          statusNorm === 'DONE'

        toCreate.push({
          customerName: customerNameStr,
          userEmail,
          customerPhone,
          activeDate,
          customerAddress,
          reason,
          marketing,
          radboox,
          sortIndex: (idx + 1) * 10,
          price,
          status: isClosedFromStatus || restorationDate ? 'CLOSED' : 'OPEN',
          isolationDate,
          teknisi: session.user.name ?? null,
          restorationDate: isClosedFromStatus ? restorationDate || new Date() : restorationDate || null,
          ticketDismantle,
        })
      } catch (e) {
        errorCount++
        if (errorDetails.length < 5) errorDetails.push(`Baris ${idx + 2}: ${String((e as Error).message || e)}`)
      }
    }

    // Batch insert to reduce per-row roundtrips
    const batchSize = 1000
    for (let i = 0; i < toCreate.length; i += batchSize) {
      const chunk = toCreate.slice(i, i + batchSize)
      if (chunk.length === 0) continue
      try {
        const result = await (prisma as any).isolation.createMany({
          data: chunk,
          skipDuplicates: false,
        })
        successCount += result.count
      } catch {
        // Fallback: try per-row create to salvage partial failures
        for (let j = 0; j < chunk.length; j++) {
          try {
            await (prisma as any).isolation.create({ data: chunk[j] })
            successCount++
          } catch (err) {
            errorCount++
            if (errorDetails.length < 5) errorDetails.push(`Baris ${i + j + 2}: ${String((err as Error).message || err)}`)
          }
        }
      }
    }

    cache.invalidateByPrefix('isolations:')
    return NextResponse.json({ 
      message: `Import selesai. Berhasil: ${successCount}, Gagal: ${errorCount}`,
      successCount,
      errorCount,
      errors: errorDetails
    })
    
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
