import assert from 'node:assert/strict'
import test from 'node:test'
import { mapRawLogsToEmployeeFingerprints, normalizeUsers } from '@/lib/hr-machine'

test('machine user normalization never exposes PIN or other device fields', () => {
  const users = normalizeUsers({
    data: [
      {
        uid: 12,
        userId: '0042',
        name: 'Ayu',
        password: '1234',
        role: 14,
        cardno: 9876,
      },
    ],
  })

  assert.deepEqual(users, [{ uid: 12, userId: '0042', name: 'Ayu', canDelete: false }])
})

test('raw logs still map to employee fingerprints after a device user is deleted', () => {
  const userMap = mapRawLogsToEmployeeFingerprints(
    [
      { deviceUserId: '0042' },
      { user_id: '7' },
      { user_id: '__proto__' },
      { user_id: 'unknown' },
      { user_id: '' },
    ],
    [
      { id: 1, fingerprintId: '0042' },
      { id: 2, fingerprintId: '7' },
      { id: 3, fingerprintId: null },
      { id: 4, fingerprintId: '__proto__' },
    ]
  )

  assert.equal(Object.getPrototypeOf(userMap), null)
  assert.deepEqual(Object.fromEntries(Object.entries(userMap)), Object.fromEntries([
    ['7', 2],
    ['0042', 1],
    ['__proto__', 4],
  ]))
})
