import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDailyActivityVisibilityWhere,
  isDailyActivityAllDivisionsRole,
  isDailyActivityDivisionManager,
  type DailyActivityVisibilityScope,
} from '@/lib/daily-activity-visibility'

function scope(overrides: Partial<DailyActivityVisibilityScope> = {}): DailyActivityVisibilityScope {
  return {
    userId: 7,
    role: 'MARKETING',
    position: 'staff',
    division: 'Pemasaran dan Pelayanan',
    subdivision: 'Marketing',
    planningLevel: 'STAFF',
    ...overrides,
  }
}

test('staf biasa hanya melihat aktivitas miliknya sendiri', () => {
  assert.deepEqual(buildDailyActivityVisibilityWhere(scope()), { ownerUserId: 7 })
})

test('SPV tidak memperoleh akses lintas divisi maupun lintas sub divisi', () => {
  const spv = scope({ position: 'spv', planningLevel: 'SPV' })
  assert.equal(isDailyActivityAllDivisionsRole(spv), false)
  assert.equal(isDailyActivityDivisionManager(spv), false)
  assert.deepEqual(buildDailyActivityVisibilityWhere(spv), { ownerUserId: 7 })
})

test('Admin, Developer, dan Priority dapat melihat seluruh divisi', () => {
  for (const role of ['ADMIN', 'DEVELOPER', 'PRIORITY']) {
    const user = scope({ role, position: null, planningLevel: 'MANAGER' })
    assert.equal(isDailyActivityAllDivisionsRole(user), true)
    assert.deepEqual(buildDailyActivityVisibilityWhere(user), {})
  }
})

test('General Affair sub divisi Legal dapat melihat seluruh divisi', () => {
  const legal = scope({ role: 'GENERAL_AFFAIR', subdivision: 'Legal', position: 'staff' })
  assert.equal(isDailyActivityAllDivisionsRole(legal), true)
  assert.deepEqual(buildDailyActivityVisibilityWhere(legal), {})
})

test('General Affair sub divisi lain tetap hanya melihat aktivitasnya sendiri', () => {
  const inventory = scope({ role: 'GENERAL_AFFAIR', subdivision: 'Inventory', position: 'staff' })
  assert.equal(isDailyActivityAllDivisionsRole(inventory), false)
  assert.deepEqual(buildDailyActivityVisibilityWhere(inventory), { ownerUserId: 7 })
})

test('manager divisi melihat seluruh sub divisi pada divisinya sendiri', () => {
  const manager = scope({ position: 'manager', planningLevel: 'MANAGER' })
  assert.equal(isDailyActivityDivisionManager(manager), true)
  assert.deepEqual(buildDailyActivityVisibilityWhere(manager), {
    OR: [{ ownerUserId: 7 }, { division: 'Pemasaran dan Pelayanan' }],
  })
})

test('level manager tanpa jabatan manager tetap melihat divisinya sendiri', () => {
  const manager = scope({ position: 'staff', planningLevel: 'MANAGER' })
  assert.deepEqual(buildDailyActivityVisibilityWhere(manager), {
    OR: [{ ownerUserId: 7 }, { division: 'Pemasaran dan Pelayanan' }],
  })
})

test('scope "mine" selalu membatasi ke aktivitas milik sendiri', () => {
  assert.deepEqual(buildDailyActivityVisibilityWhere(scope({ role: 'ADMIN' }), 'mine'), { ownerUserId: 7 })
  assert.deepEqual(buildDailyActivityVisibilityWhere(scope({ position: 'manager' }), 'mine'), { ownerUserId: 7 })
})
