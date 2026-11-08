export const HR_DIVISIONS = [
  'Pemasaran dan Pelayanan',
  'Customer Service',
  'NOC & Teknisi',
  'Creator Digital',
  'HR & Kepegawaian',
] as const

export type HrDivision = (typeof HR_DIVISIONS)[number]

export const DEFAULT_HR_DIVISION: HrDivision = 'Pemasaran dan Pelayanan'

export const HR_EMPLOYMENT_STATUSES = ['Karyawan', 'Kontrak', 'Magang', 'Resign'] as const

export type HrEmploymentStatus = (typeof HR_EMPLOYMENT_STATUSES)[number]

export function isKnownDivision(value: string): value is HrDivision {
  return (HR_DIVISIONS as readonly string[]).includes(value)
}

export function isKnownEmploymentStatus(value: string): value is HrEmploymentStatus {
  return (HR_EMPLOYMENT_STATUSES as readonly string[]).includes(value)
}
