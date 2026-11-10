import { DEFAULT_HR_DIVISION, HR_DIVISION_SUBDIVISIONS, HR_DIVISIONS, isKnownDivision, type HrDivision } from '@/lib/hr-departments'

/**
 * Struktur organisasi modul Daily Activity PSB.
 * Divisi mengikuti departemen HR (`HR_DIVISIONS`) agar konsisten dengan modul HR,
 * sedangkan subdivisi dipakai untuk mempersempit scope approval atasan.
 */

export const DAILY_ACTIVITY_PLANNING_LEVELS = ['STAFF', 'LEADER', 'SPV', 'MANAGER'] as const

export type DailyActivityPlanningLevel = (typeof DAILY_ACTIVITY_PLANNING_LEVELS)[number]

/** Level yang boleh melakukan approval terhadap rencana/laporan bawahannya. */
export const DAILY_ACTIVITY_APPROVER_LEVELS: DailyActivityPlanningLevel[] = ['LEADER', 'SPV', 'MANAGER']

export const DAILY_ACTIVITY_LEVEL_RANK: Record<DailyActivityPlanningLevel, number> = {
  STAFF: 0,
  LEADER: 1,
  SPV: 2,
  MANAGER: 3,
}

export const DAILY_ACTIVITY_EXECUTION_STATUSES = ['PLANNED', 'DONE', 'PENDING', 'CANCEL'] as const
export type DailyActivityExecutionStatus = (typeof DAILY_ACTIVITY_EXECUTION_STATUSES)[number]

export const DAILY_ACTIVITY_APPROVAL_STATUSES = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'] as const
export type DailyActivityApprovalStatus = (typeof DAILY_ACTIVITY_APPROVAL_STATUSES)[number]

export const DAILY_ACTIVITY_PRIORITY_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const
export type DailyActivityPriorityLevel = (typeof DAILY_ACTIVITY_PRIORITY_LEVELS)[number]

export const DAILY_ACTIVITY_EXECUTION_STATUS_LABELS: Record<DailyActivityExecutionStatus, string> = {
  PLANNED: 'Direncanakan',
  DONE: 'Selesai',
  PENDING: 'Tertunda',
  CANCEL: 'Dibatalkan',
}

export const DAILY_ACTIVITY_APPROVAL_STATUS_LABELS: Record<DailyActivityApprovalStatus, string> = {
  NONE: 'Belum Diajukan',
  PENDING: 'Menunggu Approval',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
}

export const DAILY_ACTIVITY_PRIORITY_LABELS: Record<DailyActivityPriorityLevel, string> = {
  HIGH: 'Prioritas Tinggi',
  MEDIUM: 'Prioritas Sedang',
  LOW: 'Prioritas Rendah',
}

/** Daftar subdivisi mengikuti struktur organisasi HR agar konsisten dengan data karyawan. */
export const DAILY_ACTIVITY_DIVISION_SUBDIVISIONS: Record<HrDivision, readonly string[]> = HR_DIVISION_SUBDIVISIONS

export function isValidDailyActivityDivision(value?: string | null): value is HrDivision {
  return isKnownDivision(String(value ?? '').trim())
}

/** Normalisasi nama divisi bebas (termasuk alias lama) ke daftar departemen HR PSB. */
export function normalizeDailyActivityDivisionName(value?: string | null): HrDivision {
  const raw = String(value ?? '').trim()
  if (isKnownDivision(raw)) return raw

  const lower = raw.toLowerCase()
  if (!lower) return DEFAULT_HR_DIVISION

  if (lower.includes('marketing') || lower.includes('penjualan') || lower.includes('pelayanan')) {
    return 'Pemasaran dan Pelayanan'
  }
  if (lower.includes('teknisi') || lower.includes('teknik') || lower.includes('noc')) return 'Teknisi'
  if (lower.includes('finance') || lower.includes('keuangan') || lower.includes('hr')) return 'Finance & HR'
  if (lower.includes('general manager') || lower.includes('gm') || lower.includes('manager')) return 'General Manager'
  if (lower.includes('umum') || lower.includes('affair') || lower.includes('ga')) return 'General Affair'
  if (lower.includes('operasional') || lower.includes('operational')) return 'Operasional'

  return DEFAULT_HR_DIVISION
}

export function isValidDailyActivityPlanningLevel(value?: string | null): value is DailyActivityPlanningLevel {
  const upper = String(value ?? '').trim().toUpperCase()
  return (DAILY_ACTIVITY_PLANNING_LEVELS as readonly string[]).includes(upper)
}

export function normalizeDailyActivityPlanningLevel(value?: string | null): DailyActivityPlanningLevel {
  const upper = String(value ?? '').trim().toUpperCase()
  return isValidDailyActivityPlanningLevel(upper) ? upper : 'STAFF'
}

export function isDailyActivityApproverLevel(value?: string | null) {
  const level = normalizeDailyActivityPlanningLevel(value)
  return DAILY_ACTIVITY_APPROVER_LEVELS.includes(level)
}

export function getDailyActivityLevelRank(value?: string | null) {
  return DAILY_ACTIVITY_LEVEL_RANK[normalizeDailyActivityPlanningLevel(value)]
}

export function getDailyActivitySubdivisions(division?: string | null): readonly string[] {
  return DAILY_ACTIVITY_DIVISION_SUBDIVISIONS[normalizeDailyActivityDivisionName(division)] ?? []
}

export function isValidDailyActivitySubdivision(division: string | null | undefined, subdivision?: string | null) {
  const value = String(subdivision ?? '').trim()
  if (!value) return false
  const list = getDailyActivitySubdivisions(division)
  return list.some((item) => item.toLowerCase() === value.toLowerCase())
}

export function resolveDefaultDailyActivitySubdivision(division?: string | null) {
  return getDailyActivitySubdivisions(division)[0] ?? ''
}

export function isDailyActivityExecutionStatus(value?: string | null): value is DailyActivityExecutionStatus {
  return (DAILY_ACTIVITY_EXECUTION_STATUSES as readonly string[]).includes(
    String(value ?? '').trim().toUpperCase()
  )
}

export function isDailyActivityApprovalStatus(value?: string | null): value is DailyActivityApprovalStatus {
  return (DAILY_ACTIVITY_APPROVAL_STATUSES as readonly string[]).includes(
    String(value ?? '').trim().toUpperCase()
  )
}

export function isDailyActivityPriorityLevel(value?: string | null): value is DailyActivityPriorityLevel {
  return (DAILY_ACTIVITY_PRIORITY_LEVELS as readonly string[]).includes(
    String(value ?? '').trim().toUpperCase()
  )
}

/** Daftar divisi yang aktif di modul Daily Activity. General Manager sementara dikecualikan. */
const DAILY_ACTIVITY_EXCLUDED_DIVISIONS = ['General Manager'] as const

export function getAllDailyActivityDivisions(): HrDivision[] {
  return HR_DIVISIONS.filter((d) => !(DAILY_ACTIVITY_EXCLUDED_DIVISIONS as readonly string[]).includes(d))
}
