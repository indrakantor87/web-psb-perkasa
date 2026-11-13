import assert from 'node:assert/strict'
import test from 'node:test'
import { getProbeStatus, getProbeAvailability, PROBE_STALE_AFTER_MS } from '@/lib/noc-dashboard'

const now = new Date('2026-11-13T10:00:00.000Z')

test('probe status distinguishes down, warning, and missing samples', () => {
  assert.equal(getProbeStatus([], now), 'UNKNOWN')
  assert.equal(getProbeStatus([{ success: true, checkedAt: now.toISOString() }], now), 'UP')
  assert.equal(getProbeStatus([{ success: false, checkedAt: now.toISOString() }], now), 'WARNING')
  assert.equal(
    getProbeStatus(
      [
        { success: false, checkedAt: now.toISOString() },
        { success: false, checkedAt: new Date(now.getTime() - 60_000).toISOString() },
      ],
      now,
    ),
    'DOWN',
  )
})

test('probe status becomes unknown beyond the 15 minute stale window', () => {
  const fresh = new Date(now.getTime() - (PROBE_STALE_AFTER_MS - 1_000)).toISOString()
  const stale = new Date(now.getTime() - (PROBE_STALE_AFTER_MS + 1_000)).toISOString()
  assert.equal(getProbeStatus([{ success: true, checkedAt: fresh }], now), 'UP')
  assert.equal(getProbeStatus([{ success: true, checkedAt: stale }], now), 'UNKNOWN')
})

test('probe availability is unknown when no checks exist', () => {
  assert.equal(getProbeAvailability(0, 0), null)
  assert.equal(getProbeAvailability(9, 10), 90)
})
