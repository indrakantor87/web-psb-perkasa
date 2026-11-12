export type AppMenuKey =
  | 'dashboard'
  | 'input'
  | 'list'
  | 'marketing-activities'
  | 'daily-activity'
  | 'isolir'
  | 'dismantle'
  | 'odp'
  | 'jalur'
  | 'trouble-ticket'
  | 'content-calendar'
  | 'campaigns'
  | 'digital-leads'
  | 'analytics'
  | 'hr'
  | 'settings'

export type AppSettingsKey =
  | 'areas'
  | 'packages'
  | 'templates'
  | 'users'
  | 'role-audit'
  | 'security-logs'
  | 'trouble-ticket'
  | 'priorities'

export type AppDivisionCode = 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'

export const APP_ROLE_VALUES = [
  'ADMIN',
  'DEVELOPER',
  'PRIORITY',
  'CS',
  'ADMIN_CS',
  'NOC',
  'MARKETING',
  'TEKNISI',
  'TROUBLESHOOTS',
  'CREATOR_DIGITAL',
  'DISMANTLE',
  'HR',
  'FINANCE',
  'GENERAL_AFFAIR',
  'OPERASIONAL',
] as const

export function normalizeRole(role?: string | null) {
  return String(role ?? '').trim().toUpperCase()
}

export function isReadOnlyRole(role?: string | null) {
  return normalizeRole(role) === 'PRIORITY'
}

const PRIORITY_ALLOWED_API_WRITES = new Set([
  'POST /api/auth/logout',
  'POST /api/auth/change-password',
  'POST /api/maps/resolve',
  'POST /api/push-tokens',
  'DELETE /api/push-tokens',
])

export function isPriorityMutationBlocked(role: string | null | undefined, method: string, pathname: string) {
  if (!isReadOnlyRole(role)) return false

  const normalizedMethod = method.trim().toUpperCase()
  const normalizedPath = pathname.trim().replace(/\/+$/, '') || '/'

  if (
    ['GET', 'HEAD'].includes(normalizedMethod) &&
    normalizedPath === '/api/marketing-activities/setup-db'
  ) {
    return true
  }
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) return false

  return !PRIORITY_ALLOWED_API_WRITES.has(`${normalizedMethod} ${normalizedPath}`)
}

export function isAdminRole(role?: string | null) {
  const roleUpper = normalizeRole(role)
  return roleUpper === 'ADMIN' || roleUpper === 'DEVELOPER'
}

export function isDeveloperRole(role?: string | null) {
  return normalizeRole(role) === 'DEVELOPER'
}

export function canViewAllDataRole(role?: string | null) {
  const roleUpper = normalizeRole(role)
  return roleUpper === 'ADMIN' || roleUpper === 'DEVELOPER' || roleUpper === 'PRIORITY'
}

export function isTechnicianRole(role?: string | null) {
  return hasAnyRole(role, ['TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE'])
}

/**
 * Role yang dapat melihat seluruh karyawan (Daftar Karyawan dan absensi semua
 * karyawan). Role lain hanya boleh melihat absensi miliknya sendiri.
 */
export function canAccessHrEmployees(role?: string | null) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'PRIORITY', 'HR', 'FINANCE'])
}

export function canManageHrRecords(role?: string | null) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'HR', 'FINANCE'])
}

export function canReadFingerprintMachine(role?: string | null) {
  return isDeveloperRole(role)
}

export function canConfigureFingerprintMachine(role?: string | null) {
  return isDeveloperRole(role)
}

export function canRunAttendanceOperations(role?: string | null) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'HR', 'FINANCE'])
}

export function canManageTargetUser(actorRole?: string | null, targetRole?: string | null) {
  const actor = normalizeRole(actorRole)
  const target = normalizeRole(targetRole)
  if (actor === 'DEVELOPER') return true
  return actor === 'ADMIN' && target !== 'DEVELOPER'
}

export function normalizeDivision(division?: string | null): AppDivisionCode {
  const divisionUpper = String(division ?? '').trim().toUpperCase()
  if (
    divisionUpper === 'PENJUALAN' ||
    divisionUpper === 'CS_ADMIN' ||
    divisionUpper === 'NOC_TROUBLESHOOTS' ||
    divisionUpper === 'CREATOR_DIGITAL'
  ) {
    return divisionUpper
  }
  return 'ALL'
}

export function getDivisionFromRole(role?: string | null) {
  const roleUpper = normalizeRole(role)
  if (roleUpper === 'MARKETING') return 'PENJUALAN'
  if (roleUpper === 'CS' || roleUpper === 'ADMIN_CS') return 'CS_ADMIN'
  if (roleUpper === 'NOC' || isTechnicianRole(roleUpper)) return 'NOC_TROUBLESHOOTS'
  if (roleUpper === 'CREATOR_DIGITAL') return 'CREATOR_DIGITAL'
  return 'ALL'
}

export function getMenuDataDivision(menu: AppMenuKey, perspectiveDivision?: string | null): AppDivisionCode {
  const division = normalizeDivision(perspectiveDivision)

  switch (menu) {
    case 'input':
    case 'marketing-activities':
      return 'PENJUALAN'
    case 'list':
      if (division === 'CS_ADMIN' || division === 'NOC_TROUBLESHOOTS' || division === 'PENJUALAN') return division
      return 'PENJUALAN'
    case 'isolir':
      return division === 'NOC_TROUBLESHOOTS' ? 'NOC_TROUBLESHOOTS' : 'CS_ADMIN'
    case 'dismantle':
      return division === 'NOC_TROUBLESHOOTS' ? 'NOC_TROUBLESHOOTS' : 'CS_ADMIN'
    case 'odp':
      return 'CS_ADMIN'
    case 'jalur':
      return 'CS_ADMIN'
    case 'trouble-ticket':
      return 'NOC_TROUBLESHOOTS'
    case 'content-calendar':
    case 'campaigns':
    case 'digital-leads':
    case 'analytics':
      return 'CREATOR_DIGITAL'
    default:
      return division
  }
}

export function getMenuHref(menu: Exclude<AppMenuKey, 'dashboard' | 'settings'>, perspectiveDivision?: string | null) {
  const division = getMenuDataDivision(menu, perspectiveDivision)

  switch (menu) {
    case 'input':
      return `/input?division=${division}`
    case 'list':
      return `/list?division=${division}`
    case 'marketing-activities':
      return `/marketing-activities?division=${division}`
    case 'daily-activity':
      return '/daily-activity'
    case 'isolir':
      return `/isolir?division=${division}`
    case 'dismantle':
      return `/dismantle?division=${division}&status=OPEN`
    case 'odp':
      return `/odp?division=${division}`
    case 'jalur':
      return '/jalur'
    case 'trouble-ticket':
      return `/trouble-ticket?division=${division}`
    case 'content-calendar':
      return '/content-calendar?division=CREATOR_DIGITAL'
    case 'campaigns':
      return '/campaigns?division=CREATOR_DIGITAL'
    case 'digital-leads':
      return '/digital-leads?division=CREATOR_DIGITAL'
    case 'analytics':
      return '/analytics?division=CREATOR_DIGITAL'
    case 'hr':
      return '/hr'
  }
}

export function getDefaultPathForRole(role?: string | null) {
  if (canAccessMenu(role, 'dashboard')) return '/'

  const roleUpper = normalizeRole(role)
  const preferredMenus: AppMenuKey[] =
    roleUpper === 'CREATOR_DIGITAL'
      ? ['content-calendar', 'campaigns', 'digital-leads', 'analytics']
      : ['input', 'list', 'trouble-ticket', 'dismantle', 'content-calendar', 'hr', 'marketing-activities', 'isolir', 'odp']

  const menu = preferredMenus.find((item) => canAccessMenu(role, item))
  if (!menu || menu === 'dashboard' || menu === 'settings') return '/profile'
  return getMenuHref(menu, getDivisionFromRole(role))
}

function menuSet(items: AppMenuKey[]) {
  return new Set<AppMenuKey>(items)
}

function settingsSet(items: AppSettingsKey[]) {
  return new Set<AppSettingsKey>(items)
}

/**
 * Daily Activity diperuntukkan untuk:
 * - Developer, Admin, Priority (selalu all access)
 * - Jabatan General Manager, Manager, SPV, Leader, PIC
 * - General Affair dengan sub divisi Legal
 */
export function canAccessDailyActivity(
  role?: string | null,
  position?: string | null,
  subdivision?: string | null
): boolean {
  const roleUpper = normalizeRole(role)
  if (canViewAllDataRole(roleUpper)) return true

  if (roleUpper === 'GENERAL_AFFAIR') {
    const sub = String(subdivision ?? '').trim().toLowerCase()
    return sub === 'legal'
  }

  const pos = String(position ?? '').trim().toLowerCase()
  return (
    pos === 'general manager' ||
    pos === 'manager' ||
    pos === 'spv' ||
    pos === 'leader' ||
    pos === 'pic'
  )
}

function getAccessibleMenus(
  role?: string | null,
  position?: string | null,
  subdivision?: string | null
) {
  const roleUpper = normalizeRole(role)
  const daAllowed = canAccessDailyActivity(roleUpper, position, subdivision)

  let menus: Set<AppMenuKey>

  if (canViewAllDataRole(roleUpper)) {
    menus = menuSet([
      'dashboard',
      'input',
      'list',
      'marketing-activities',
      'daily-activity',
      'isolir',
      'dismantle',
      'odp',
      'jalur',
      'trouble-ticket',
      'content-calendar',
      'campaigns',
      'digital-leads',
      'analytics',
      'hr',
      'settings',
    ])
    if (roleUpper === 'PRIORITY') {
      menus.delete('input')
      menus.delete('marketing-activities')
      menus.delete('content-calendar')
      menus.delete('campaigns')
      menus.delete('digital-leads')
      menus.delete('analytics')
    }
    return menus
  }

  if (roleUpper === 'HR' || roleUpper === 'FINANCE') {
    menus = menuSet(['dashboard', 'hr'])
  } else if (roleUpper === 'GENERAL_AFFAIR') {
    menus = menuSet(['dashboard', 'hr'])
  } else if (roleUpper === 'OPERASIONAL') {
    menus = menuSet(['dashboard', 'list', 'trouble-ticket', 'odp', 'dismantle', 'isolir'])
  } else if (roleUpper === 'MARKETING') {
    menus = menuSet(['input', 'list', 'marketing-activities', 'isolir', 'dismantle', 'odp', 'trouble-ticket', 'hr'])
  } else if (roleUpper === 'CS' || roleUpper === 'ADMIN_CS') {
    menus = menuSet(['dashboard', 'input', 'list', 'isolir', 'dismantle', 'odp', 'trouble-ticket'])
  } else if (roleUpper === 'NOC') {
    menus = menuSet(['dashboard', 'list', 'dismantle', 'odp', 'jalur', 'trouble-ticket'])
  } else if (roleUpper === 'CREATOR_DIGITAL') {
    menus = menuSet([
      'dashboard',
      'input',
      'list',
      'isolir',
      'dismantle',
      'odp',
      'content-calendar',
      'campaigns',
      'digital-leads',
      'analytics',
    ])
  } else if (isTechnicianRole(roleUpper)) {
    menus = menuSet(['list', 'odp', 'jalur', 'trouble-ticket', 'dismantle'])
  } else {
    menus = menuSet([])
  }

  if (daAllowed) menus.add('daily-activity')
  // Semua role dapat membuka halaman Absensi; cakupan datanya dibatasi ke akun
  // yang login, kecuali Developer/Priority/Admin/HR (lihat canAccessHrEmployees).
  menus.add('hr')
  return menus
}

export function canAccessMenu(
  role: string | null | undefined,
  menu: AppMenuKey,
  position?: string | null,
  subdivision?: string | null
) {
  return getAccessibleMenus(role, position, subdivision).has(menu)
}

function getAccessibleSettingsPages(role?: string | null) {
  const roleUpper = normalizeRole(role)

  if (canViewAllDataRole(roleUpper)) {
    const settingsPages: AppSettingsKey[] = [
      'areas',
      'packages',
      'templates',
      'users',
      'trouble-ticket',
      'priorities',
    ]
    if (isDeveloperRole(roleUpper)) {
      settingsPages.push('role-audit', 'security-logs')
    }
    return settingsSet(settingsPages)
  }

  if (roleUpper === 'NOC') {
    return settingsSet(['trouble-ticket'])
  }

  return settingsSet([])
}

export function canAccessSettingsPage(role: string | null | undefined, page: AppSettingsKey) {
  return getAccessibleSettingsPages(role).has(page)
}

export function hasAnySettingsAccess(role: string | null | undefined) {
  return getAccessibleSettingsPages(role).size > 0
}

export function canMutateMenu(role: string | null | undefined, menu: AppMenuKey) {
  const roleUpper = normalizeRole(role)

  if (isReadOnlyRole(roleUpper)) return false
  if (isAdminRole(roleUpper)) return true

  switch (menu) {
    case 'input':
      return roleUpper === 'MARKETING' || roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'CREATOR_DIGITAL'
    case 'list':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'NOC' || isTechnicianRole(roleUpper)
    case 'marketing-activities':
      return false
    case 'daily-activity':
      return true
    case 'isolir':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS'
    case 'dismantle':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'NOC' || isTechnicianRole(roleUpper)
    case 'odp':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'NOC' || isTechnicianRole(roleUpper)
    case 'jalur':
      return roleUpper === 'NOC' || isTechnicianRole(roleUpper)
    case 'trouble-ticket':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'NOC' || isTechnicianRole(roleUpper)
    case 'content-calendar':
    case 'campaigns':
    case 'digital-leads':
    case 'analytics':
      return roleUpper === 'CREATOR_DIGITAL'
    case 'hr':
      return roleUpper === 'HR' || roleUpper === 'FINANCE'
    default:
      return false
  }
}

export function isReadOnlyMenu(role: string | null | undefined, menu: AppMenuKey) {
  return canAccessMenu(role, menu) && !canMutateMenu(role, menu)
}

export function hasAnyRole(role: string | null | undefined, allowedRoles: string[]) {
  const roleUpper = normalizeRole(role)
  return allowedRoles.some((item) => normalizeRole(item) === roleUpper)
}

export function canManageListTickets(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'CS', 'ADMIN_CS', 'NOC']) || isTechnicianRole(role)
}

export function canDeleteListTickets(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'CS', 'ADMIN_CS', 'NOC'])
}

export function canImportListTickets(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'ADMIN_CS', 'CS', 'NOC', 'MARKETING', 'CREATOR_DIGITAL'])
}

export function canAccessTroubleTicketRecords(role: string | null | undefined) {
  return canAccessMenu(role, 'trouble-ticket')
}

export function canMutateTroubleTicketRecords(role: string | null | undefined) {
  return canMutateMenu(role, 'trouble-ticket')
}

export function canMutateIsolationRecords(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'CS', 'ADMIN_CS'])
}

export function canDeleteIsolationRecords(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'CS', 'ADMIN_CS'])
}

export function canUseAdminIsolationDismantleScope(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'PRIORITY', 'CS', 'ADMIN_CS'])
}

export function canMutateMarketingActivities(role: string | null | undefined) {
  return isAdminRole(role)
}

export function canMutateOdpRecords(role: string | null | undefined) {
  return canMutateMenu(role, 'odp')
}

export function canMutateCreatorDigitalMenu(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'DEVELOPER', 'CREATOR_DIGITAL'])
}

/**
 * Role yang hanya boleh melihat data miliknya sendiri berdasarkan akun pembuat.
 * Dipakai oleh modul konten digital (ContentCalendar/Campaign/DigitalLead),
 * sedangkan scope data PSB mengikuti aturan nama marketing.
 */
export function isAccountOwnerScopedRole(role?: string | null) {
  return normalizeRole(role) === 'CREATOR_DIGITAL'
}

/**
 * Role yang cakupan data PSB-nya ditentukan oleh nama marketing pada tiket
 * (kolom `marketingName`), bukan id akun pembuat. MARKETING dan CREATOR_DIGITAL
 * memakai aturan yang sama agar konsisten dengan Kinerja Marketing di dashboard.
 */
export function isMarketingNameScopedRole(role?: string | null) {
  const roleUpper = normalizeRole(role)
  return roleUpper === 'MARKETING' || roleUpper === 'CREATOR_DIGITAL'
}

/**
 * Menghasilkan id pemilik untuk filter query.
 * - `null` berarti role tersebut boleh melihat semua data.
 * - `-1` berarti role dibatasi ke data sendiri tetapi id akun tidak tersedia,
 *   sehingga tidak ada record yang cocok (fail-closed).
 */
export function resolveAccountOwnerFilter(role?: string | null, userId?: number | null) {
  if (!isAccountOwnerScopedRole(role)) return null
  return typeof userId === 'number' && Number.isFinite(userId) ? userId : -1
}
