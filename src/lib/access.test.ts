import assert from 'node:assert/strict'
import test from 'node:test'
import {
  APP_ROLE_VALUES,
  canAccessSettingsPage,
  canAccessMenu,
  canAccessTroubleTicketRecords,
  canConfigureFingerprintMachine,
  canDeleteIsolationRecords,
  canMutateIsolationRecords,
  canMutateMenu,
  canMutateOdpRecords,
  canMutateTroubleTicketRecords,
  canReadFingerprintMachine,
  canRunAttendanceOperations,
  isAccountOwnerScopedRole,
  isDeveloperRole,
  isMarketingNameScopedRole,
  resolveAccountOwnerFilter,
} from '@/lib/access'
import { isMarketingOwnerMatch } from '@/lib/marketing-users'

const menus = [
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
  'hr',
  'settings',
] as const

test('Audit Role and Log Aktivitas are Developer-only settings', () => {
  const developerOnlySettings = ['role-audit', 'security-logs'] as const
  for (const setting of developerOnlySettings) {
    assert.equal(canAccessSettingsPage('DEVELOPER', setting), true)
    for (const role of APP_ROLE_VALUES.filter((item) => item !== 'DEVELOPER')) {
      assert.equal(canAccessSettingsPage(role, setting), false, `${role} must not access ${setting}`)
    }
  }
  assert.equal(canAccessSettingsPage('ADMIN', 'users'), true)
  assert.equal(canAccessSettingsPage('PRIORITY', 'users'), true)
})

test('ADMIN and DEVELOPER can access and mutate every menu', () => {
  for (const role of ['ADMIN', 'DEVELOPER']) {
    for (const menu of menus) {
      assert.equal(canAccessMenu(role, menu), true, `${role} should access ${menu}`)
      assert.equal(canMutateMenu(role, menu), true, `${role} should mutate ${menu}`)
    }
  }
})

test('PRIORITY has global read access without mutation rights', () => {
  for (const menu of menus) {
    assert.equal(canAccessMenu('PRIORITY', menu), true, `PRIORITY should access ${menu}`)
    assert.equal(canMutateMenu('PRIORITY', menu), false, `PRIORITY must not mutate ${menu}`)
  }
})

test('HR can manage HR while marketing activity access remains read-only', () => {
  assert.equal(canAccessMenu('HR', 'dashboard'), true)
  assert.equal(canAccessMenu('HR', 'marketing-activities'), true)
  assert.equal(canMutateMenu('HR', 'marketing-activities'), false)
  assert.equal(canMutateMenu('HR', 'hr'), true)
  assert.equal(canAccessMenu('HR', 'settings'), false)
})

test('MARKETING receives the assigned operational modules without Dashboard access', () => {
  for (const menu of ['input', 'list', 'marketing-activities', 'isolir', 'dismantle', 'odp', 'trouble-ticket', 'hr'] as const) {
    assert.equal(canAccessMenu('MARKETING', menu), true, `MARKETING should access ${menu}`)
  }
  assert.equal(canAccessMenu('MARKETING', 'dashboard'), false)
  assert.equal(canAccessMenu('MARKETING', 'settings'), false)
  assert.equal(canMutateMenu('MARKETING', 'input'), true)
  for (const menu of ['list', 'marketing-activities', 'isolir', 'dismantle', 'odp', 'trouble-ticket', 'hr'] as const) {
    assert.equal(canMutateMenu('MARKETING', menu), false, `MARKETING must not mutate ${menu}`)
  }
})

test('fingerprint machine configuration and db-update authority are Developer-only', () => {
  for (const role of ['ADMIN', 'PRIORITY', 'HR']) {
    assert.equal(canReadFingerprintMachine(role), false)
    assert.equal(canConfigureFingerprintMachine(role), false)
    assert.equal(isDeveloperRole(role), false)
  }
  assert.equal(canReadFingerprintMachine('DEVELOPER'), true)
  assert.equal(canConfigureFingerprintMachine('DEVELOPER'), true)
  assert.equal(isDeveloperRole('DEVELOPER'), true)
})

test('HR attendance operations are available only to Admin, Developer, and HR', () => {
  for (const role of ['ADMIN', 'DEVELOPER', 'HR']) {
    assert.equal(canRunAttendanceOperations(role), true)
  }
  for (const role of ['PRIORITY', 'MARKETING', 'CS']) {
    assert.equal(canRunAttendanceOperations(role), false)
  }
})

test('ADMIN_CS preserves the same menu and mutation matrix as CS', () => {
  for (const menu of menus) {
    assert.equal(canAccessMenu('ADMIN_CS', menu), canAccessMenu('CS', menu), menu)
    assert.equal(canMutateMenu('ADMIN_CS', menu), canMutateMenu('CS', menu), menu)
  }
})

test('legacy technician roles preserve TEKNISI menu and mutation access', () => {
  for (const role of ['TROUBLESHOOTS', 'DISMANTLE']) {
    for (const menu of menus) {
      assert.equal(canAccessMenu(role, menu), canAccessMenu('TEKNISI', menu), `${role} access ${menu}`)
      assert.equal(canMutateMenu(role, menu), canMutateMenu('TEKNISI', menu), `${role} mutate ${menu}`)
    }
  }
})

test('marketing ownership requires a non-empty matching session owner', () => {
  assert.equal(isMarketingOwnerMatch('  Siti   Aminah ', 'Siti Aminah'), true)
  assert.equal(isMarketingOwnerMatch('Siti Aminah', ''), false)
  assert.equal(isMarketingOwnerMatch('', 'Siti Aminah'), false)
  assert.equal(isMarketingOwnerMatch('Budi Santoso', 'Siti Aminah'), false)
})

test('Isolir and Dismantle mutations stay limited to Admin, Developer, CS, and Admin CS', () => {
  for (const role of ['ADMIN', 'DEVELOPER', 'CS', 'ADMIN_CS']) {
    assert.equal(canMutateIsolationRecords(role), true, `${role} should mutate Isolir`)
    assert.equal(canDeleteIsolationRecords(role), true, `${role} should delete Isolir`)
  }
  for (const role of ['PRIORITY', 'MARKETING', 'NOC', 'TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE', 'HR']) {
    assert.equal(canMutateIsolationRecords(role), false, `${role} must not mutate Isolir`)
    assert.equal(canDeleteIsolationRecords(role), false, `${role} must not delete Isolir`)
  }
})

test('Trouble Ticket access allows Marketing read-only while technicians keep mutation', () => {
  assert.equal(canAccessTroubleTicketRecords('MARKETING'), true)
  assert.equal(canMutateTroubleTicketRecords('MARKETING'), false)
  assert.equal(canAccessTroubleTicketRecords('PRIORITY'), true)
  assert.equal(canMutateTroubleTicketRecords('PRIORITY'), false)
  for (const role of ['TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE', 'NOC', 'CS', 'ADMIN_CS']) {
    assert.equal(canAccessTroubleTicketRecords(role), true, `${role} should read Trouble Ticket`)
    assert.equal(canMutateTroubleTicketRecords(role), true, `${role} should mutate Trouble Ticket`)
  }
  assert.equal(canAccessTroubleTicketRecords('HR'), false)
})

test('ODP mutations follow the ODP menu matrix', () => {
  for (const role of ['ADMIN', 'DEVELOPER', 'CS', 'ADMIN_CS', 'NOC', 'TEKNISI']) {
    assert.equal(canMutateOdpRecords(role), true, `${role} should mutate ODP`)
  }
  for (const role of ['PRIORITY', 'MARKETING', 'HR']) {
    assert.equal(canMutateOdpRecords(role), false, `${role} must not mutate ODP`)
  }
})

test('CREATOR_DIGITAL gains Dashboard and PSB input while keeping read-only operational menus', () => {
  assert.equal(canAccessMenu('CREATOR_DIGITAL', 'dashboard'), true)
  for (const menu of [
    'input',
    'list',
    'isolir',
    'dismantle',
    'odp',
    'content-calendar',
    'campaigns',
    'digital-leads',
    'analytics',
  ] as const) {
    assert.equal(canAccessMenu('CREATOR_DIGITAL', menu), true, `CREATOR_DIGITAL should access ${menu}`)
  }
  assert.equal(canMutateMenu('CREATOR_DIGITAL', 'input'), true)
  for (const menu of ['list', 'isolir', 'dismantle', 'odp', 'marketing-activities'] as const) {
    assert.equal(canMutateMenu('CREATOR_DIGITAL', menu), false, `CREATOR_DIGITAL must not mutate ${menu}`)
  }
})

test('account owner scope fails closed when the account id is unavailable', () => {
  assert.equal(isAccountOwnerScopedRole('CREATOR_DIGITAL'), true)
  for (const role of ['ADMIN', 'DEVELOPER', 'PRIORITY', 'MARKETING', 'CS', 'HR']) {
    assert.equal(isAccountOwnerScopedRole(role), false, `${role} should keep full data visibility`)
  }
  assert.equal(resolveAccountOwnerFilter('CREATOR_DIGITAL', 42), 42)
  assert.equal(resolveAccountOwnerFilter('CREATOR_DIGITAL', null), -1)
  assert.equal(resolveAccountOwnerFilter('ADMIN', 42), null)
})

test('marketing-name scope covers MARKETING and CREATOR_DIGITAL only', () => {
  assert.equal(isMarketingNameScopedRole('MARKETING'), true)
  assert.equal(isMarketingNameScopedRole('CREATOR_DIGITAL'), true)
  for (const role of ['ADMIN', 'DEVELOPER', 'PRIORITY', 'CS', 'NOC', 'HR']) {
    assert.equal(isMarketingNameScopedRole(role), false, `${role} must not be name-scoped`)
  }
})
