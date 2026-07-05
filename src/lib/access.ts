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

export function normalizeRole(role?: string | null) {
  return String(role ?? '').trim().toUpperCase()
}

export function getDivisionFromRole(role?: string | null) {
  const roleUpper = normalizeRole(role)
  if (roleUpper === 'MARKETING') return 'PENJUALAN'
  if (roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'DISMANTLE') return 'CS_ADMIN'
  if (roleUpper === 'NOC' || roleUpper === 'TROUBLESHOOTS' || roleUpper === 'TEKNISI') return 'NOC_TROUBLESHOOTS'
  if (roleUpper === 'CREATOR_DIGITAL') return 'CREATOR_DIGITAL'
  return 'ALL'
}

function menuSet(items: AppMenuKey[]) {
  return new Set<AppMenuKey>(items)
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
    return menuSet(['dashboard', 'list', 'odp', 'trouble-ticket'])
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
      return roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'DISMANTLE'
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

export function canMutateMarketingActivities(role: string | null | undefined) {
  return normalizeRole(role) === 'ADMIN'
}

export function canMutateOdpRecords(role: string | null | undefined) {
  return canMutateMenu(role, 'odp')
}

export function canMutateCreatorDigitalMenu(role: string | null | undefined) {
  return hasAnyRole(role, ['ADMIN', 'CREATOR_DIGITAL'])
}
