export type AppMenuKey =
  | 'dashboard'
  | 'input'
  | 'list'
  | 'marketing-activities'
  | 'isolir'
  | 'dismantle'
  | 'odp'
  | 'trouble-ticket'
  | 'content-calendar'
  | 'campaigns'
  | 'digital-leads'
  | 'analytics'
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

export function normalizeRole(role?: string | null) {
  return String(role ?? '').trim().toUpperCase()
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
  if (roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'DISMANTLE') return 'CS_ADMIN'
  if (roleUpper === 'NOC' || roleUpper === 'TROUBLESHOOTS' || roleUpper === 'TEKNISI') return 'NOC_TROUBLESHOOTS'
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
    case 'isolir':
      return `/isolir?division=${division}`
    case 'dismantle':
      return `/dismantle?division=${division}&status=OPEN`
    case 'odp':
      return `/odp?division=${division}`
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
  }
}

function menuSet(items: AppMenuKey[]) {
  return new Set<AppMenuKey>(items)
}

function settingsSet(items: AppSettingsKey[]) {
  return new Set<AppSettingsKey>(items)
}

function getAccessibleMenus(role?: string | null) {
  const roleUpper = normalizeRole(role)

  if (roleUpper === 'ADMIN') {
    return menuSet([
      'dashboard',
      'input',
      'list',
      'marketing-activities',
      'isolir',
      'dismantle',
      'odp',
      'trouble-ticket',
      'content-calendar',
      'campaigns',
      'digital-leads',
      'analytics',
      'settings',
    ])
  }

  if (roleUpper === 'MARKETING') {
    return menuSet(['dashboard', 'input', 'list', 'marketing-activities', 'isolir', 'dismantle', 'odp'])
  }

  if (roleUpper === 'CS' || roleUpper === 'ADMIN_CS') {
    return menuSet(['dashboard', 'input', 'list', 'isolir', 'dismantle', 'odp', 'trouble-ticket'])
  }

  if (roleUpper === 'NOC') {
    return menuSet(['dashboard', 'list', 'dismantle', 'odp', 'trouble-ticket'])
  }

  if (roleUpper === 'CREATOR_DIGITAL') {
    return menuSet([
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
  }

  if (roleUpper === 'TEKNISI') {
    return menuSet(['dashboard', 'list', 'odp', 'trouble-ticket'])
  }

  if (roleUpper === 'TROUBLESHOOTS') {
    return menuSet(['trouble-ticket'])
  }

  if (roleUpper === 'DISMANTLE') {
    return menuSet(['dismantle'])
  }

  return menuSet(['dashboard'])
}

export function canAccessMenu(role: string | null | undefined, menu: AppMenuKey) {
  return getAccessibleMenus(role).has(menu)
}

function getAccessibleSettingsPages(role?: string | null) {
  const roleUpper = normalizeRole(role)

  if (roleUpper === 'ADMIN') {
    return settingsSet([
      'areas',
      'packages',
      'templates',
      'users',
      'role-audit',
      'security-logs',
      'trouble-ticket',
      'priorities',
    ])
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

  if (roleUpper === 'ADMIN') return true

  switch (menu) {
    case 'input':
      return roleUpper === 'MARKETING' || roleUpper === 'CS' || roleUpper === 'ADMIN_CS'
    case 'list':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'NOC' || roleUpper === 'TEKNISI'
    case 'marketing-activities':
      return false
    case 'isolir':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS'
    case 'dismantle':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'NOC' || roleUpper === 'DISMANTLE'
    case 'odp':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'NOC' || roleUpper === 'TEKNISI'
    case 'trouble-ticket':
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'NOC' || roleUpper === 'TEKNISI' || roleUpper === 'TROUBLESHOOTS'
    case 'content-calendar':
    case 'campaigns':
    case 'digital-leads':
    case 'analytics':
      return roleUpper === 'CREATOR_DIGITAL'
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
  return hasAnyRole(role, ['ADMIN', 'CS', 'ADMIN_CS', 'NOC', 'TEKNISI'])
}

export function canDeleteListTickets(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'CS', 'ADMIN_CS', 'NOC'])
}

export function canImportListTickets(role: string | null | undefined) {
  return canDeleteListTickets(role)
}

export function canAccessTroubleTicketRecords(role: string | null | undefined) {
  return canAccessMenu(role, 'trouble-ticket')
}

export function canMutateTroubleTicketRecords(role: string | null | undefined) {
  return canMutateMenu(role, 'trouble-ticket')
}

export function canMutateIsolationRecords(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'CS', 'ADMIN_CS', 'DISMANTLE'])
}

export function canDeleteIsolationRecords(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'CS', 'ADMIN_CS'])
}

export function canUseAdminIsolationDismantleScope(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'CS'])
}

export function canMutateMarketingActivities(role: string | null | undefined) {
  return normalizeRole(role) === 'ADMIN'
}

export function canMutateOdpRecords(role: string | null | undefined) {
  return canMutateMenu(role, 'odp')
}

export function canMutateCreatorDigitalMenu(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'CREATOR_DIGITAL'])
}
