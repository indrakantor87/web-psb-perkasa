import assert from 'node:assert/strict'
import test from 'node:test'
import { getNocPopStatus, getProbeAvailability } from '@/lib/noc-dashboard'

const now = new Date('2026-11-13T10:00:00.000Z')

test('NOC POP status distinguishes down, warning, and stale probes', () => {
  assert.equal(getNocPopStatus([], now), 'UNKNOWN')
  assert.equal(
    getNocPopStatus([{ success: true, checkedAt: now.toISOString() }], now),
    'UP',
  )
  assert.equal(
    getNocPopStatus([{ success: false, checkedAt: now.toISOString() }], now),
    'WARNING',
  )
  assert.equal(
    getNocPopStatus(
      [
        { success: false, checkedAt: now.toISOString() },
        { success: false, checkedAt: new Date(now.getTime() - 60_000).toISOString() },
      ],
      now,
    ),
    'DOWN',
  )
  assert.equal(
    getNocPopStatus(
      [{ success: true, checkedAt: new Date(now.getTime() - 180_001).toISOString() }],
      now,
    ),
    'UNKNOWN',
  )
})

test('NOC probe availability is unknown when no checks exist', () => {
  assert.equal(getProbeAvailability(0, 0), null)
  assert.equal(getProbeAvailability(9, 10), 90)
})
