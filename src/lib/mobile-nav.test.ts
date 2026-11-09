import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessMenu } from '@/lib/access'
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

test('Menu teknisi dan NOC tidak mengulang modul yang sudah ada di bottom navigation', () => {
  for (const role of ['TEKNISI', 'NOC']) {
    const primaryKeys = MOBILE_PRIMARY_ORDER.filter((key) => canAccessMenu(role, key)).slice(0, 4)
    const remainingGroups = getMobileMenuGroups(role, primaryKeys)

    assert.deepEqual(remainingGroups, [])
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
