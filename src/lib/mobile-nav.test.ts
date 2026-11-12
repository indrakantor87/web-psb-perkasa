import assert from 'node:assert/strict'
import test from 'node:test'
import { APP_ROLE_VALUES, canAccessMenu } from '@/lib/access'
import {
  canAccessMobileHome,
  canShowMobilePsbSummary,
  getMobileHomeHref,
  getMobilePrimaryLinks,
  getMobileShortcuts,
  isMobileTechnicianRole,
  mobileMenuEntries,
} from '@/lib/mobile-nav'

test('Mobile Beranda teknisi dan NOC memakai halaman khusus', () => {
  for (const role of ['TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE']) {
    assert.equal(canAccessMobileHome(role), true)
    assert.equal(canAccessMenu(role, 'dashboard'), false)
    assert.equal(isMobileTechnicianRole(role), true)
    assert.equal(getMobileHomeHref(role), '/beranda')
  }
  assert.equal(canAccessMobileHome('NOC'), true)
  assert.equal(canAccessMenu('NOC', 'dashboard'), true)
  assert.equal(isMobileTechnicianRole('NOC'), true)
  assert.equal(getMobileHomeHref('NOC'), '/beranda')
})

test('Mobile Beranda tetap mengikuti akses dashboard role lain', () => {
  assert.equal(canAccessMobileHome('ADMIN'), true)
  assert.equal(canAccessMobileHome('MARKETING'), true)
  assert.equal(getMobileHomeHref('MARKETING'), '/beranda')
})

test('PRIORITY Beranda tetap menyembunyikan modul marketing dan Digital', () => {
  const restrictedMenus = [
    'marketing-activities',
    'content-calendar',
    'campaigns',
    'digital-leads',
    'analytics',
  ] as const
  const shortcuts = getMobileShortcuts('PRIORITY').map((item) => item.key)

  for (const menu of restrictedMenus) {
    assert.equal(canAccessMenu('PRIORITY', menu), false, `${menu} must not be accessible`)
    assert.equal(shortcuts.includes(menu), false, `${menu} must not appear on Beranda`)
  }
})

test('Beranda menampilkan semua modul mobile yang diizinkan untuk setiap role', () => {
  for (const role of APP_ROLE_VALUES) {
    const shortcuts = new Set(getMobileShortcuts(role).map((item) => item.key))
    const primaryLinks = getMobilePrimaryLinks(role)
    assert.equal(canAccessMobileHome(role), true, `${role} needs a Beranda link`)
    assert.ok(primaryLinks.length <= 4, `${role} exceeds the mobile quick-link limit`)
    assert.equal(new Set(primaryLinks.map((item) => item.key)).size, primaryLinks.length)

    for (const entry of mobileMenuEntries) {
      if (canAccessMenu(role, entry.key)) {
        assert.ok(shortcuts.has(entry.key), `${role} loses ${entry.key} from Beranda`)
      }
    }
    for (const link of primaryLinks) {
      assert.equal(canAccessMenu(role, link.key), true, `${role} has an unauthorized quick link`)
    }

    const expectedHome = isMobileTechnicianRole(role) || !canAccessMenu(role, 'dashboard')
      ? '/beranda'
      : '/'
    assert.equal(getMobileHomeHref(role), expectedHome, `${role} has the wrong Beranda target`)
  }
})

test('Admin mempertahankan empat pintasan utama di bar bawah', () => {
  assert.deepEqual(
    getMobilePrimaryLinks('ADMIN').map((item) => item.key),
    ['list', 'trouble-ticket', 'odp', 'jalur'],
  )
})

test('Beranda menyertakan Daily Activity sesuai jabatan dan sub divisi', () => {
  assert.ok(getMobileShortcuts('OPERASIONAL', 'Manager').some((item) => item.key === 'daily-activity'))
  assert.ok(getMobileShortcuts('GENERAL_AFFAIR', null, 'Legal').some((item) => item.key === 'daily-activity'))
})

test('Beranda teknisi tidak menampilkan ringkasan PSB global', () => {
  for (const role of ['TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE', 'NOC']) {
    assert.equal(canShowMobilePsbSummary(role), false)
  }
  assert.equal(canShowMobilePsbSummary('ADMIN'), true)
})
