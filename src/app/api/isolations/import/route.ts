import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'
import { canMutateIsolationRecords } from '@/lib/access'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'
import { ensureDismantleTicketsTable, relinkDismantleTicketsForIsolationItems } from '@/lib/dismantle-tickets'
import { logSecurityEvent } from '@/lib/security-log'
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

function parseSuspendDuration(value: unknown): { months: number; days: number } | null {
  if (value == null) return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    const months = Math.trunc(value)
    return months > 0 ? { months, days: 0 } : null
  }

  const raw = String(value).trim().toLowerCase()
  if (!raw) return null

  const monthsMatch = raw.match(/(\d+)\s*bulan/)
  const daysMatch = raw.match(/(\d+)\s*hari/)

  if (monthsMatch || daysMatch) {
    const months = monthsMatch ? Number.parseInt(monthsMatch[1], 10) : 0
    const days = daysMatch ? Number.parseInt(daysMatch[1], 10) : 0
    return months > 0 || days > 0 ? { months, days } : null
  }

  const asInt = Number.parseInt(raw, 10)
  return Number.isFinite(asInt) && asInt > 0 ? { months: Math.trunc(asInt), days: 0 } : null
}

function normalizeEmail(v: unknown) {
  if (typeof v !== 'string') return ''
  return v.trim().toLowerCase()
}

function normalizePhone(v: unknown) {
  if (typeof v !== 'string') return ''
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}

function normalizeTextKey(v: unknown) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function hasDismantleHistory(item: {
  ticketDismantle?: unknown
  closeNote?: unknown
  closePhoto?: unknown
  status?: unknown
}) {
  const ticket = String(item.ticketDismantle ?? '').trim()
  const closeNote = String(item.closeNote ?? '').trim()
  const closePhoto = String(item.closePhoto ?? '').trim()
  const status = String(item.status ?? '').trim().toUpperCase()
  return ticket !== '' || closeNote !== '' || closePhoto !== '' || status === 'CLOSED'
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
    await ensureDismantleTicketsTable()

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
    const importBatchAt = new Date()

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

    const preparedByKey = new Map<string, any>()
    const radbooxSet = new Set<string>()

    let parsedCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const [idx, row] of jsonData.entries()) {
      try {
        const r = toIsoRow(row)
        const radbooxRaw = typeof r.radboox === 'string' || typeof r.radboox === 'number' ? String(r.radboox).trim() : ''
        if (!radbooxRaw) {
          skippedCount += 1
          continue
        }
        radbooxSet.add(radbooxRaw)

        const customerName = typeof r.customerName === 'string' || typeof r.customerName === 'number' ? String(r.customerName).trim() : ''
        if (!customerName) {
          skippedCount += 1
          continue
        }

        const userEmail = r.userEmail ? normalizeEmail(String(r.userEmail)) : ''
        const customerPhone = r.customerPhone ? normalizePhone(String(r.customerPhone)) : ''
        const customerAddress = r.customerAddress ? String(r.customerAddress).trim() : null
        const reason = r.reason ? String(r.reason).trim() : null
        const marketing = r.marketing ? String(r.marketing).trim() : null

        const activeDateRaw = r.activeDate
        const activeDate = activeDateRaw == null ? null : parseDate(typeof activeDateRaw === 'number' || typeof activeDateRaw === 'string' ? activeDateRaw : String(activeDateRaw))

        const price = parsePrice(r.price)

        const statusRaw = typeof r.status === 'string' || typeof r.status === 'number' ? String(r.status) : ''
        const statusNorm = statusRaw.trim().toUpperCase()

        const isoDateRaw = r.isolationDate
        const isoDateParsed = parseDate(typeof isoDateRaw === 'number' || typeof isoDateRaw === 'string' ? isoDateRaw : String(isoDateRaw ?? ''))
        const restorationRaw = r.restorationDate
        const restorationDate = parseDate(typeof restorationRaw === 'number' || typeof restorationRaw === 'string' ? restorationRaw : String(restorationRaw ?? ''))

        const suspendMonthsRaw = r.suspendMonths
        const suspend = parseSuspendDuration(suspendMonthsRaw)

        const isolationDate =
          isoDateParsed && !Number.isNaN(isoDateParsed.getTime())
            ? isoDateParsed
            : suspend
              ? (() => {
                  const d = new Date()
                  if (suspend.months > 0) d.setMonth(d.getMonth() - suspend.months)
                  if (suspend.days > 0) d.setDate(d.getDate() - suspend.days)
                  return d
                })()
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

        const statusFinal = isClosedFromStatus || restorationDate ? 'CLOSED' : 'OPEN'
        const restorationFinal = statusFinal === 'CLOSED' ? restorationDate || new Date() : null

        const keyEmail = userEmail ? `rad:${radbooxRaw}|email:${userEmail}` : ''
        const keyPhone = !keyEmail && customerPhone ? `rad:${radbooxRaw}|phone:${customerPhone}` : ''
        const nameKey = !keyEmail && !keyPhone ? normalizeTextKey(customerName) : ''
        const addrKey = !keyEmail && !keyPhone ? normalizeTextKey(customerAddress) : ''
        const keyNameAddr = nameKey ? `rad:${radbooxRaw}|name:${nameKey}|addr:${addrKey}` : ''
        const key = keyEmail || keyPhone || keyNameAddr
        if (!key) {
          skippedCount += 1
          continue
        }

        parsedCount += 1
        preparedByKey.set(key, {
          customerName,
          userEmail: userEmail || null,
          customerPhone: customerPhone || null,
          activeDate,
          customerAddress,
          reason,
          marketing,
          radboox: radbooxRaw,
          price,
          status: statusFinal,
          isolationDate,
          teknisi: session.user.name ?? null,
          restorationDate: restorationFinal,
          ticketDismantle,
          importBatchAt,
          importRowOrder: idx + 1,
        })
      } catch (e) {
        errorCount += 1
        if (errors.length < 10) errors.push(`Baris ${idx + 2}: ${String((e as Error).message || e)}`)
      }
    }

    const radbooxValues = Array.from(radbooxSet).filter(Boolean)
    if (radbooxValues.length === 0) {
      return NextResponse.json({ error: 'Radboox tidak ditemukan di file' }, { status: 400 })
    }

    const existing = await (prisma as any).isolation.findMany({
      where: { radboox: { in: radbooxValues } },
      select: {
        id: true,
        radboox: true,
        customerName: true,
        customerAddress: true,
        customerPhone: true,
        userEmail: true,
        status: true,
        ticketDismantle: true,
        closeNote: true,
        closePhoto: true,
        isArchived: true,
      },
    })

    const existingKeyToRow = new Map<string, any>()
    for (const row of existing as any[]) {
      const rad = String(row.radboox ?? '').trim()
      if (!rad) continue
      const email = normalizeEmail(row.userEmail)
      const phone = normalizePhone(row.customerPhone)
      const nameKey = normalizeTextKey(row.customerName)
      const addrKey = normalizeTextKey(row.customerAddress)

      const emailKey = email ? `rad:${rad}|email:${email}` : ''
      const phoneKey = !emailKey && phone ? `rad:${rad}|phone:${phone}` : ''
      const nameAddrKey = !emailKey && !phoneKey && nameKey ? `rad:${rad}|name:${nameKey}|addr:${addrKey}` : ''
      const key = emailKey || phoneKey || nameAddrKey
      if (!key) continue
      if (!existingKeyToRow.has(key)) {
        existingKeyToRow.set(key, row)
      }
    }

    let inserted = 0
    let updated = 0
    const relinkCandidates: Array<{
      id: number
      radboox: string | null
      userEmail: string | null
      customerPhone: string | null
      customerName: string
      customerAddress: string | null
    }> = []
    const importedOpenIdsByRadboox = new Map<string, Set<number>>()

    for (const [key, data] of preparedByKey.entries()) {
      const existingRow = existingKeyToRow.get(key)
      if (existingRow) {
        await (prisma as any).isolation.update({
          where: { id: existingRow.id },
          data,
        })
        updated += 1
          relinkCandidates.push({
            id: existingRow.id,
            radboox: data.radboox ?? null,
            userEmail: data.userEmail ?? null,
            customerPhone: data.customerPhone ?? null,
            customerName: data.customerName,
            customerAddress: data.customerAddress ?? null,
          })
        const rad = String(data.radboox ?? '').trim()
        if (rad) {
          if (!importedOpenIdsByRadboox.has(rad)) importedOpenIdsByRadboox.set(rad, new Set())
          if (String(data.status).toUpperCase() === 'OPEN') importedOpenIdsByRadboox.get(rad)!.add(existingRow.id)
        }
        continue
      }

      const created = await (prisma as any).isolation.create({ data })
      inserted += 1
      relinkCandidates.push({
        id: created.id,
        radboox: data.radboox ?? null,
        userEmail: data.userEmail ?? null,
        customerPhone: data.customerPhone ?? null,
        customerName: data.customerName,
        customerAddress: data.customerAddress ?? null,
      })
      const rad = String(data.radboox ?? '').trim()
      if (rad && String(data.status).toUpperCase() === 'OPEN') {
        if (!importedOpenIdsByRadboox.has(rad)) importedOpenIdsByRadboox.set(rad, new Set())
        importedOpenIdsByRadboox.get(rad)!.add(created.id)
      }
    }

    await relinkDismantleTicketsForIsolationItems(relinkCandidates)

    let deleted = 0
    let archived = 0
    for (const rad of radbooxValues) {
      const keepOpen = importedOpenIdsByRadboox.get(rad) ?? new Set<number>()
      const candidates = (existing as any[])
        .filter((row) => String(row.radboox ?? '').trim() === rad)
        .filter((row) => String(row.status ?? '').trim().toUpperCase() === 'OPEN')
        .filter((row) => row.isArchived !== true)

      const toRemove = candidates.filter((row) => {
        const email = normalizeEmail(row.userEmail)
        const phone = normalizePhone(row.customerPhone)
        const nameKey = normalizeTextKey(row.customerName)
        const addrKey = normalizeTextKey(row.customerAddress)
        const emailKey = email ? `rad:${rad}|email:${email}` : ''
        const phoneKey = !emailKey && phone ? `rad:${rad}|phone:${phone}` : ''
        const nameAddrKey = !emailKey && !phoneKey && nameKey ? `rad:${rad}|name:${nameKey}|addr:${addrKey}` : ''
        const key = emailKey || phoneKey || nameAddrKey
        if (!key) return false
        return !preparedByKey.has(key) && !keepOpen.has(row.id)
      })

      for (const row of toRemove) {
        if (hasDismantleHistory(row)) {
          await (prisma as any).isolation.update({
            where: { id: row.id },
            data: { isArchived: true, archivedAt: new Date() },
          })
          archived += 1
          continue
        }
        await (prisma as any).isolation.delete({ where: { id: row.id } })
        deleted += 1
      }
    }

    cache.invalidateByPrefix('isolations:')
    await logSecurityEvent({
      action: 'ISOLATIONS_IMPORT',
      request,
      user: { id: session.user.id, username: session.user.username, role: session.user.role },
      meta: { parsedCount, inserted, updated, deleted, archived, skippedCount, errorCount },
    }).catch(() => {})
    return NextResponse.json({
      message: `Import sinkron selesai. Insert: ${inserted}, Update: ${updated}, Hapus: ${deleted}, Arsip: ${archived}, Skip: ${skippedCount}, Error: ${errorCount}`,
      parsedCount,
      inserted,
      updated,
      deleted,
      archived,
      skippedCount,
      errorCount,
      errors,
    })
    
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
