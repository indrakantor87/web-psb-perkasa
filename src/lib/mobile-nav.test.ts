import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessMenu } from '@/lib/access'
import {
  canAccessMobileHome,
  canShowMobilePsbSummary,
  getMobileMenuGroups,
  MOBILE_PRIMARY_ORDER,
} from '@/lib/mobile-nav'

test('Mobile Beranda tersedia untuk role teknisi tanpa memberi akses dashboard desktop', () => {
  for (const role of ['TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE']) {
    assert.equal(canAccessMobileHome(role), true)
    assert.equal(canAccessMenu(role, 'dashboard'), false)
  }
})

test('Mobile Beranda tetap mengikuti akses dashboard role lain', () => {
  assert.equal(canAccessMobileHome('ADMIN'), true)
  assert.equal(canAccessMobileHome('MARKETING'), false)
})

test('Menu teknisi tidak mengulang modul yang sudah ada di bottom navigation', () => {
  const primaryKeys = MOBILE_PRIMARY_ORDER
    .filter((key) => canAccessMenu('TEKNISI', key))
    .slice(0, 4)
  const remainingGroups = getMobileMenuGroups('TEKNISI', primaryKeys)

  assert.deepEqual(remainingGroups, [])
})

test('Beranda teknisi tidak menampilkan ringkasan PSB global', () => {
  for (const role of ['TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE']) {
    assert.equal(canShowMobilePsbSummary(role), false)
  }
  assert.equal(canShowMobilePsbSummary('ADMIN'), true)
})
