import assert from 'node:assert/strict'
import test from 'node:test'
import { HR_DIVISIONS } from '@/lib/hr-departments'
import { getDefaultUserDivision, normalizeUserDivision } from '@/lib/user-division'

test('user division normalization follows the HR division list', () => {
  for (const division of HR_DIVISIONS) {
    assert.equal(normalizeUserDivision(division), division)
    assert.equal(normalizeUserDivision(division.toUpperCase()), division)
  }
})

test('legacy operational divisions normalize to HR divisions', () => {
  assert.equal(normalizeUserDivision('PENJUALAN'), 'Pemasaran dan Pelayanan')
  assert.equal(normalizeUserDivision('CS_ADMIN'), 'Pemasaran dan Pelayanan')
  assert.equal(normalizeUserDivision('CREATOR_DIGITAL'), 'Pemasaran dan Pelayanan')
  assert.equal(normalizeUserDivision('NOC_TROUBLESHOOTS'), 'Teknisi')
})

test('new user division defaults use HR divisions by role', () => {
  assert.equal(getDefaultUserDivision('MARKETING'), 'Pemasaran dan Pelayanan')
  assert.equal(getDefaultUserDivision('CREATOR_DIGITAL'), 'Pemasaran dan Pelayanan')
  assert.equal(getDefaultUserDivision('TEKNISI'), 'Teknisi')
  assert.equal(getDefaultUserDivision('HR'), 'Finance & HR')
  assert.equal(getDefaultUserDivision('ADMIN'), null)
})
