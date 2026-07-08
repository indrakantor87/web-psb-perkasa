const DAY_MS = 24 * 60 * 60 * 1000

function normalizeDateInput(value: string | Date) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return date
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addMonthsClamped(date: Date, months: number) {
  const originalDay = date.getDate()
  const target = new Date(date)
  target.setDate(1)
  target.setMonth(target.getMonth() + months)
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(originalDay, lastDayOfTargetMonth))
  return target
}

export function getSuspendDurationParts(value: string | Date | null | undefined, nowInput: Date = new Date()) {
  if (!value) return null

  const fromDateRaw = normalizeDateInput(value)
  if (!fromDateRaw) return null

  const fromDate = startOfDay(fromDateRaw)
  const now = startOfDay(nowInput)

  if (fromDate.getTime() > now.getTime()) {
    return { totalDays: 0, months: 0, days: 0 }
  }

  let months = (now.getFullYear() - fromDate.getFullYear()) * 12 + (now.getMonth() - fromDate.getMonth())
  if (now.getDate() < fromDate.getDate()) {
    months -= 1
  }
  months = Math.max(0, months)

  let anchor = addMonthsClamped(fromDate, months)
  while (anchor.getTime() > now.getTime() && months > 0) {
    months -= 1
    anchor = addMonthsClamped(fromDate, months)
  }

  const totalDays = Math.max(0, Math.floor((now.getTime() - fromDate.getTime()) / DAY_MS))
  const days = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / DAY_MS))

  return { totalDays, months, days }
}

export function formatSuspendDuration(value: string | Date | null | undefined, nowInput: Date = new Date()) {
  const parts = getSuspendDurationParts(value, nowInput)
  if (!parts) return '-'

  if (parts.months <= 0) {
    return `${parts.totalDays} Hari`
  }

  if (parts.days <= 0) {
    return `${parts.months} Bulan`
  }

  return `${parts.months} Bulan ${parts.days} Hari`
}

export function hasMonthlySuspend(value: string | Date | null | undefined, nowInput: Date = new Date()) {
  const parts = getSuspendDurationParts(value, nowInput)
  return parts ? parts.months >= 1 : false
}

export function isDismantleEligible(value: string | Date | null | undefined, nowInput: Date = new Date()) {
  return hasMonthlySuspend(value, nowInput)
}
