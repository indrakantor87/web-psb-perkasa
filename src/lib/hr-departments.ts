export const HR_DIVISIONS = [
  'Pemasaran dan Pelayanan',
  'General Affair',
  'Teknisi',
  'Finance & HR',
  'General Manager',
] as const

export type HrDivision = (typeof HR_DIVISIONS)[number]

export const DEFAULT_HR_DIVISION: HrDivision = 'Pemasaran dan Pelayanan'

/** Sub divisi per divisi HR — baseline klasifikasi & kewenangan karyawan. */
export const HR_DIVISION_SUBDIVISIONS: Record<HrDivision, readonly string[]> = {
  'Pemasaran dan Pelayanan': ['Marketing', 'Customer Service', 'Admin CS'],
  'General Affair': ['Umum', 'Kebersihan', 'Keamanan'],
  Teknisi: ['Instalasi', 'Gangguan', 'Maintenance'],
  'Finance & HR': ['Keuangan', 'HR', 'Payroll'],
  'General Manager': ['Operasional'],
}

export function getHrSubdivisions(division?: string | null): readonly string[] {
  const value = String(division ?? '').trim()
  return isKnownDivision(value) ? HR_DIVISION_SUBDIVISIONS[value] : []
}

export function isKnownHrSubdivision(division?: string | null, subdivision?: string | null): boolean {
  const value = String(subdivision ?? '').trim()
  if (!value) return false
  return getHrSubdivisions(division).some((item) => item.toLowerCase() === value.toLowerCase())
}

export const HR_EMPLOYMENT_STATUSES = ['Karyawan', 'Kontrak', 'Magang', 'Resign'] as const

export type HrEmploymentStatus = (typeof HR_EMPLOYMENT_STATUSES)[number]

export function isKnownDivision(value: string): value is HrDivision {
  return (HR_DIVISIONS as readonly string[]).includes(value)
}

export function isKnownEmploymentStatus(value: string): value is HrEmploymentStatus {
  return (HR_EMPLOYMENT_STATUSES as readonly string[]).includes(value)
}
