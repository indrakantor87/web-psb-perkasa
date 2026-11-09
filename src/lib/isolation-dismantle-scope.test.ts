import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDismantleMarketingOwners,
  buildIsolationMarketingOwnerFilter,
} from '@/lib/isolation-dismantle-scope'

test('Isolir scope menyamakan MARKETING dan CREATOR_DIGITAL berdasarkan nama', () => {
  const expected = {
    marketing: { equals: 'Iman Digital', mode: 'insensitive' },
  }

  assert.deepEqual(buildIsolationMarketingOwnerFilter('MARKETING', '  Iman   Digital '), expected)
  assert.deepEqual(buildIsolationMarketingOwnerFilter('CREATOR_DIGITAL', '  Iman   Digital '), expected)
})

test('Dismantle scope menyamakan MARKETING dan CREATOR_DIGITAL berdasarkan nama', () => {
  assert.deepEqual(buildDismantleMarketingOwners('MARKETING', '  Iman   Digital '), ['Iman Digital'])
  assert.deepEqual(buildDismantleMarketingOwners('CREATOR_DIGITAL', '  Iman   Digital '), ['Iman Digital'])
})

test('Scope Isolir dan Dismantle gagal-tertutup jika nama akun kosong', () => {
  for (const role of ['MARKETING', 'CREATOR_DIGITAL']) {
    assert.deepEqual(buildIsolationMarketingOwnerFilter(role, '  '), { id: { lt: 0 } })
    assert.deepEqual(buildDismantleMarketingOwners(role, null), [])
  }
})

test('Role lain tidak menerima scope pemilik marketing', () => {
  assert.equal(buildIsolationMarketingOwnerFilter('ADMIN', 'Iman'), null)
  assert.equal(buildDismantleMarketingOwners('ADMIN', 'Iman'), null)
})
