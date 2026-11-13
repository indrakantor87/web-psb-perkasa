import { isAdminRole, normalizeRole } from '@/lib/access'

export function canReadGmDailyReport(role?: string | null) {
  const roleUpper = normalizeRole(role)
  return isAdminRole(role) || roleUpper === 'PRIORITY' || roleUpper === 'FINANCE'
}

export function canManageGmDailyReport(role?: string | null) {
  const roleUpper = normalizeRole(role)
  return isAdminRole(role) || roleUpper === 'FINANCE'
}
