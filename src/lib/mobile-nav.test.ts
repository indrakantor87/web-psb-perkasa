import assert from 'node:assert/strict'
import test from 'node:test'
import { APP_ROLE_VALUES, canAccessMenu } from '@/lib/access'
import {
  canAccessMobileHome,
  canShowMobilePsbSummary,
  getMobileHomeHref,
  getMobileMenuGroups,
  isMobileTechnicianRole,
  MOBILE_PRIMARY_ORDER,
  mobileMenuEntries,
} from '@/lib/mobile-nav'

test('Mobile Beranda teknisi dan NOC memakai halaman khusus tanpa akses dashboard desktop', () => {
  for (const role of ['TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE', 'NOC']) {
    assert.equal(canAccessMobileHome(role), true)
    assert.equal(canAccessMenu(role, 'dashboard'), false)
    assert.equal(isMobileTechnicianRole(role), true)
    assert.equal(getMobileHomeHref(role), '/beranda')
  }
})

test('Mobile Beranda tetap mengikuti akses dashboard role lain', () => {
  assert.equal(canAccessMobileHome('ADMIN'), true)
  assert.equal(canAccessMobileHome('MARKETING'), false)
})

function primaryKeysFor(role: string) {
  return MOBILE_PRIMARY_ORDER.filter((key) => canAccessMenu(role, key)).slice(0, 4)
}

test('PRIORITY mobile navigation hides marketing activity and Digital modules', () => {
  const restrictedMenus = [
    'marketing-activities',
    'content-calendar',
    'campaigns',
    'digital-leads',
    'analytics',
  ] as const
  const primaryKeys = primaryKeysFor('PRIORITY')
  const mobileMenuKeys = getMobileMenuGroups('PRIORITY', primaryKeys).flatMap((group) =>
    group.links.map((link) => link.key),
  )

  for (const menu of restrictedMenus) {
    assert.equal(canAccessMenu('PRIORITY', menu), false, `${menu} must not be accessible`)
    assert.equal(primaryKeys.includes(menu), false, `${menu} must not appear in bottom navigation`)
    assert.equal(mobileMenuKeys.includes(menu), false, `${menu} must not appear in the mobile menu`)
  }
})

test('Menu mobile tidak mengulang modul yang sudah ada di bottom navigation untuk semua role', () => {
  for (const role of APP_ROLE_VALUES) {
    const primaryKeys = primaryKeysFor(role)
    const remainingKeys = getMobileMenuGroups(role, primaryKeys).flatMap((group) =>
      group.links.map((link) => link.key),
    )

    assert.deepEqual(
      remainingKeys.filter((key) => primaryKeys.includes(key)),
      [],
      `${role} menampilkan modul yang sama di bottom navigation dan menu`,
    )
  }
})

test('Menu mobile tetap menjangkau semua modul yang tidak muat di bottom navigation', () => {
  for (const role of APP_ROLE_VALUES) {
    const primaryKeys = primaryKeysFor(role)
    const remainingKeys = getMobileMenuGroups(role, primaryKeys).flatMap((group) =>
      group.links.map((link) => link.key),
    )
    const reachable = new Set([...primaryKeys, ...remainingKeys])

    for (const entry of mobileMenuEntries) {
      if (canAccessMenu(role, entry.key)) {
        assert.ok(reachable.has(entry.key), `${role} kehilangan akses ke ${entry.key}`)
      }
    }
  }
})

test('Beranda teknisi tidak menampilkan ringkasan PSB global', () => {
  for (const role of ['TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE', 'NOC']) {
    assert.equal(canShowMobilePsbSummary(role), false)
  }
  assert.equal(canShowMobilePsbSummary('ADMIN'), true)
})

test('Label List PSB pada bottom navigation cukup ringkas', () => {
  const listEntry = mobileMenuEntries.find((item) => item.key === 'list')

  assert.equal(listEntry?.label, 'List Data PSB')
  assert.equal(listEntry?.shortLabel, 'List PSB')
})
