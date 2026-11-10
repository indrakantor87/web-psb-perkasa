import { HR_DIVISIONS, type HrDivision } from '@/lib/hr-departments'

const LEGACY_DIVISION_MAP: Record<string, HrDivision> = {
  PENJUALAN: 'Pemasaran dan Pelayanan',
  CS_ADMIN: 'Pemasaran dan Pelayanan',
  NOC_TROUBLESHOOTS: 'Teknisi',
  CREATOR_DIGITAL: 'Pemasaran dan Pelayanan',
}

export function normalizeUserDivision(value?: string | null): HrDivision | null {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (!normalized) return null

  const hrDivision = HR_DIVISIONS.find((division) => division.toUpperCase() === normalized)
  if (hrDivision) return hrDivision

  return LEGACY_DIVISION_MAP[normalized] ?? null
}

export function getDefaultUserDivision(role: string): HrDivision | null {
  const roleUpper = String(role ?? '').trim().toUpperCase()
  if (roleUpper === 'MARKETING' || roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'CREATOR_DIGITAL') {
    return 'Pemasaran dan Pelayanan'
  }
  if (roleUpper === 'NOC' || roleUpper === 'TEKNISI' || roleUpper === 'TROUBLESHOOTS' || roleUpper === 'DISMANTLE' || roleUpper === 'OPERASIONAL') {
    return 'Teknisi'
  }
  if (roleUpper === 'HR') return 'Finance & HR'
  if (roleUpper === 'GENERAL_AFFAIR') return 'General Affair'
  return null
}
