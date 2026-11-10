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
  'Pemasaran dan Pelayanan': ['Marketing', 'Customer Service', 'NOC', 'Troubleshoots'],
  'General Affair': ['Legal', 'Inventory'],
  Teknisi: ['PSB', 'Expan', 'Jointer'],
  'Finance & HR': ['Finance', 'HR', 'Admin Finance'],
  'General Manager': ['General Manager'],
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

/** Daftar jabatan standar untuk klasifikasi & kewenangan karyawan. */
export const HR_POSITIONS = ['General Manager', 'Manager', 'SPV', 'Leader', 'PIC', 'Karyawan'] as const

export type HrPosition = (typeof HR_POSITIONS)[number]

export const DEFAULT_HR_POSITION: HrPosition = 'Karyawan'

export function isKnownPosition(value: string): value is HrPosition {
  return (HR_POSITIONS as readonly string[]).includes(value)
}

export function isKnownDivision(value: string): value is HrDivision {
  return (HR_DIVISIONS as readonly string[]).includes(value)
}

export function isKnownEmploymentStatus(value: string): value is HrEmploymentStatus {
  return (HR_EMPLOYMENT_STATUSES as readonly string[]).includes(value)
}
