export const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000

export function jakartaNow() {
  return new Date(Date.now() + JAKARTA_OFFSET_MS)
}

export function jakartaMonthRange(year: number, month1to12: number) {
  const startUtcMs = Date.UTC(year, month1to12 - 1, 1) - JAKARTA_OFFSET_MS
  const endUtcMs = Date.UTC(year, month1to12, 1) - JAKARTA_OFFSET_MS
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) }
}

export function jakartaDateFromDMY(day: number, month1to12: number, year: number) {
  return new Date(Date.UTC(year, month1to12 - 1, day) - JAKARTA_OFFSET_MS)
}

export function jakartaDateFromExcelSerial(serial: number) {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  return jakartaDateFromDMY(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear())
}
