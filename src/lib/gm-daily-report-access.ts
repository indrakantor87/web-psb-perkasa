import { isAdminRole, isSalesSupervisor, normalizeRole } from '@/lib/access'

export function canReadGmDailyReport(
  role?: string | null,
  position?: string | null,
  subdivision?: string | null,
  division?: string | null
) {
  const roleUpper = normalizeRole(role)
  return (
    isAdminRole(role) ||
    roleUpper === 'PRIORITY' ||
    roleUpper === 'FINANCE' ||
    isSalesSupervisor(role, position, subdivision, division)
  )
}

export function canManageGmDailyReport(role?: string | null) {
  const roleUpper = normalizeRole(role)
  return isAdminRole(role) || roleUpper === 'FINANCE'
}
