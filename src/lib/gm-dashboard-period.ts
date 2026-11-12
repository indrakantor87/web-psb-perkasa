import { jakartaMonthRange, jakartaNow } from './jakarta-time'

export const GM_DASHBOARD_MONTHS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
] as const

function parseBoundedInteger(value: string | null, fallback: number, min: number, max: number) {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

export function resolveGmDashboardPeriod(params: URLSearchParams, now = jakartaNow()) {
  return {
    year: parseBoundedInteger(params.get('year'), now.getUTCFullYear(), 2020, 2100),
    month: parseBoundedInteger(params.get('month'), now.getUTCMonth() + 1, 1, 12),
  }
}

export function getGmDashboardPeriodRange(year: number, month: number) {
  return jakartaMonthRange(year, month)
}

export function getGmDashboardQueryRange(year: number, month: number, now = new Date()) {
  const { start, end: fullPeriodEnd } = getGmDashboardPeriodRange(year, month)
  const hasStarted = start.getTime() < now.getTime()
  const end = new Date(Math.max(start.getTime(), Math.min(fullPeriodEnd.getTime(), now.getTime())))
  return { start, end, hasStarted }
}

export function getGmDashboardPeriodLabel(year: number, month: number) {
  return `${GM_DASHBOARD_MONTHS[month - 1]?.label ?? 'Bulan'} ${year}`
}
