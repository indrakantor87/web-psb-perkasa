import type { Prisma } from '@prisma/client'
import { isAdminRole, normalizeRole } from '@/lib/access'
import type { DailyActivityPlanningLevel } from '@/lib/daily-activity-org'

/** Bagian scope yang menentukan cakupan data Daily Activity yang boleh dilihat. */
export type DailyActivityVisibilityScope = {
  userId: number
  role: string
  position: string | null
  division: string
  subdivision: string | null
  planningLevel: DailyActivityPlanningLevel
}

const ALL_DIVISIONS_GA_SUBDIVISION = 'legal'

function isManagerPosition(position?: string | null) {
  const normalized = String(position ?? '').trim().toLowerCase()
  return normalized === 'manager' || normalized === 'general manager'
}

/**
 * Developer, Priority, Admin, dan General Affair (sub divisi Legal) dapat
 * melihat aktivitas harian seluruh divisi.
 */
export function isDailyActivityAllDivisionsRole(scope: DailyActivityVisibilityScope) {
  const roleUpper = normalizeRole(scope.role)
  if (isAdminRole(roleUpper)) return true
  if (roleUpper === 'PRIORITY') return true
  if (roleUpper === 'GENERAL_AFFAIR') {
    return String(scope.subdivision ?? '').trim().toLowerCase() === ALL_DIVISIONS_GA_SUBDIVISION
  }
  return false
}

/**
 * Manager divisi dapat melihat aktivitas harian seluruh sub divisi pada
 * divisinya sendiri, tetapi tidak lintas divisi.
 */
export function isDailyActivityDivisionManager(scope: DailyActivityVisibilityScope) {
  if (isDailyActivityAllDivisionsRole(scope)) return false
  return isManagerPosition(scope.position) || scope.planningLevel === 'MANAGER'
}

/**
 * Aturan visibilitas: pengguna biasa hanya melihat aktivitas miliknya sendiri,
 * kecuali developer/priority/admin/GA Legal (seluruh divisi) dan manager divisi
 * (seluruh sub divisi pada divisi yang sama).
 */
export function buildDailyActivityVisibilityWhere(
  scope: DailyActivityVisibilityScope,
  scopeFilter?: string | null
): Prisma.DailyActivityItemWhereInput {
  const mode = String(scopeFilter ?? 'all').trim().toLowerCase()

  if (mode === 'mine') return { ownerUserId: scope.userId }
  if (isDailyActivityAllDivisionsRole(scope)) return {}
  if (isDailyActivityDivisionManager(scope)) {
    return { OR: [{ ownerUserId: scope.userId }, { division: scope.division }] }
  }
  return { ownerUserId: scope.userId }
}
