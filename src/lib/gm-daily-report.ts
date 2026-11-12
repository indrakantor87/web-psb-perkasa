export type GmDailyReportValues = {
  totalPsbList: number
  installationQueue: number
  installedToday: number
  totalCustomers: number
  activeCustomers: number
  isolationContinued: number
  isolationNotContinued: number
  dismantleOpen: number
  dismantleClosed: number
  customerDeclinePercent: number
}

export type ParsedGmDailyReportRow = GmDailyReportValues & {
  reportDate: string
}

export type GmReportMerge = {
  s: { r: number; c: number }
  e: { r: number; c: number }
}

export type GmReportParseResult = {
  rows: ParsedGmDailyReportRow[]
  errors: string[]
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function validDateKey(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseGmReportDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return validDateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const date = new Date(Math.round((value - 25569) * 86_400_000))
    return validDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }

  const text = String(value ?? '').trim()
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) return validDateKey(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))

  const dmyMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (!dmyMatch) return null
  const year = Number(dmyMatch[3]) < 100 ? 2000 + Number(dmyMatch[3]) : Number(dmyMatch[3])
  return validDateKey(year, Number(dmyMatch[2]), Number(dmyMatch[1]))
}

function parseCount(value: unknown, blankValue?: number): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return blankValue ?? null
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null
  }

  const text = String(value).trim().replace(/\s/g, '')
  if (!text) return blankValue ?? null
  const grouped = text.match(/^(\d{1,3})(?:[.,](\d{3}))+$/)
  const normalized = grouped ? text.replace(/[.,]/g, '') : text.replace(/[.,]0+$/, '')
  if (!/^\d+$/.test(normalized)) return null
  const count = Number(normalized)
  return Number.isSafeInteger(count) ? count : null
}

function parsePercent(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null
  if (typeof value === 'number') {
    const percent = value > 0 && value <= 1 ? value * 100 : value
    return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? Number(percent.toFixed(2)) : null
  }

  const text = String(value).trim().replace('%', '').replace(',', '.')
  const percent = Number(text)
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? Number(percent.toFixed(2)) : null
}

function mappedHeaderCell(
  rows: unknown[][],
  merges: GmReportMerge[],
  rowIndex: number,
  columnIndex: number,
) {
  const merge = merges.find(
    (item) =>
      rowIndex >= item.s.r &&
      rowIndex <= item.e.r &&
      columnIndex >= item.s.c &&
      columnIndex <= item.e.c,
  )
  return merge ? rows[merge.s.r]?.[merge.s.c] : rows[rowIndex]?.[columnIndex]
}

function makeHeaders(rows: unknown[][], merges: GmReportMerge[], headerStart: number, dataStart: number) {
  const width = Math.max(0, ...rows.slice(headerStart, dataStart).map((row) => row.length))
  return Array.from({ length: width }, (_, columnIndex) =>
    rows
      .slice(headerStart, dataStart)
      .map((_, offset) => normalizeHeader(mappedHeaderCell(rows, merges, headerStart + offset, columnIndex)))
      .filter(Boolean)
      .join(' '),
  )
}

export function parseGmReportGrid(rows: unknown[][], merges: GmReportMerge[] = []): GmReportParseResult {
  const headerStart = rows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === 'TANGGAL'))
  if (headerStart < 0) return { rows: [], errors: ['Header TANGGAL tidak ditemukan.'] }

  const dateColumn = rows[headerStart].findIndex((cell) => normalizeHeader(cell) === 'TANGGAL')
  const dataStart = rows.findIndex((row, index) => index > headerStart && parseGmReportDate(row[dateColumn]) !== null)
  if (dataStart < 0) return { rows: [], errors: ['Tidak ditemukan baris data bertanggal setelah header.'] }

  const headers = makeHeaders(rows, merges, headerStart, dataStart)
  const findColumn = (predicate: (header: string) => boolean) => headers.findIndex(predicate)
  const columns = {
    date: dateColumn,
    totalPsbList: findColumn((header) => header.includes('TOTAL LIST PSB')),
    installationQueue: findColumn((header) => header.includes('ANTRIAN PASANG')),
    installedToday: findColumn((header) => header.includes('TERPASANG')),
    totalCustomers: findColumn((header) => header.includes('TOTAL PELANGGAN') && header.includes('RADBOX') && !header.includes('AKTIF')),
    isolationContinued: findColumn((header) => header.includes('MASIH DILANJUT')),
    isolationNotContinued: findColumn((header) => header.includes('TIDAK DILANJUT')),
    dismantleOpen: findColumn((header) => header.includes('DISMANTLE') && header.includes('OPEN')),
    dismantleClosed: findColumn((header) => header.includes('DISMANTLE') && (header.includes('CLOSED') || header.includes('CLOSE'))),
    customerDeclinePercent: findColumn((header) => header.includes('PENURUNAN PELANGGAN')),
    activeCustomers: findColumn((header) => header.includes('TOTAL PELANGGAN AKTIF')),
  }

  const requiredColumns = Object.entries(columns).filter(([name, index]) => name !== 'date' && index < 0)
  if (requiredColumns.length > 0) {
    return {
      rows: [],
      errors: [`Kolom wajib tidak ditemukan: ${requiredColumns.map(([name]) => name).join(', ')}.`],
    }
  }

  const parsedRows: ParsedGmDailyReportRow[] = []
  const errors: string[] = []
  const seenDates = new Set<string>()

  for (let rowIndex = dataStart; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const reportDate = parseGmReportDate(row[columns.date])
    const metricColumns = Object.entries(columns)
      .filter(([name]) => name !== 'date')
      .map(([, index]) => index)
    const hasMetrics = metricColumns.some((columnIndex) => String(row[columnIndex] ?? '').trim() !== '')
    if (!reportDate && !hasMetrics) continue
    if (!reportDate) {
      errors.push(`Baris ${rowIndex + 1}: tanggal tidak valid.`)
      continue
    }
    if (!hasMetrics) continue
    if (seenDates.has(reportDate)) {
      errors.push(`Baris ${rowIndex + 1}: tanggal ${reportDate} muncul lebih dari sekali.`)
      continue
    }
    seenDates.add(reportDate)

    const getCount = (name: keyof typeof columns, blankValue?: number) =>
      parseCount(row[columns[name]], blankValue)
    const totalPsbList = getCount('totalPsbList')
    const installationQueue = getCount('installationQueue')
    const installedToday = getCount('installedToday')
    const totalCustomers = getCount('totalCustomers')
    const activeCustomers = getCount('activeCustomers')
    const isolationContinued = getCount('isolationContinued')
    const isolationNotContinued = getCount('isolationNotContinued')
    const dismantleOpen = getCount('dismantleOpen')
    const dismantleClosed = getCount('dismantleClosed', 0)
    const customerDeclinePercent = parsePercent(row[columns.customerDeclinePercent])

    const invalidFields = [
      ['total PSB', totalPsbList],
      ['antrian pasang', installationQueue],
      ['terpasang', installedToday],
      ['total pelanggan', totalCustomers],
      ['pelanggan aktif', activeCustomers],
      ['isolir masih dilanjutkan', isolationContinued],
      ['isolir tidak dilanjutkan', isolationNotContinued],
      ['dismantle open', dismantleOpen],
      ['dismantle closed', dismantleClosed],
      ['penurunan pelanggan', customerDeclinePercent],
    ].filter(([, value]) => value === null)

    if (invalidFields.length > 0) {
      errors.push(
        `Baris ${rowIndex + 1}: nilai tidak valid${invalidFields.length ? ` (${invalidFields.map(([name]) => name).join(', ')})` : ''}.`,
      )
      continue
    }

    parsedRows.push({
      reportDate,
      totalPsbList: totalPsbList!,
      installationQueue: installationQueue!,
      installedToday: installedToday!,
      totalCustomers: totalCustomers!,
      activeCustomers: activeCustomers!,
      isolationContinued: isolationContinued!,
      isolationNotContinued: isolationNotContinued!,
      dismantleOpen: dismantleOpen!,
      dismantleClosed: dismantleClosed!,
      customerDeclinePercent: customerDeclinePercent!,
    })
  }

  if (parsedRows.length === 0 && errors.length === 0) {
    errors.push('Tidak ada baris rekap yang terisi untuk diimpor.')
  }

  return { rows: parsedRows, errors }
}
