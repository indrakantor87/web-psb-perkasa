import { isAdminRole, normalizeRole } from '@/lib/access'

export function canReadGmDailyReport(role?: string | null) {
  return isAdminRole(role) || normalizeRole(role) === 'PRIORITY'
}

export function canManageGmDailyReport(role?: string | null) {
  return isAdminRole(role)
}
