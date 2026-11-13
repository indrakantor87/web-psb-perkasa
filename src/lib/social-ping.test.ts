import assert from 'node:assert/strict'
import test from 'node:test'
import { isReachableStatus, SOCIAL_PLATFORMS } from '@/lib/social-ping'

test('HTTP responses below 500 count as reachable', () => {
  assert.equal(isReachableStatus(200), true)
  assert.equal(isReachableStatus(301), true)
  assert.equal(isReachableStatus(403), true)
  assert.equal(isReachableStatus(499), true)
  assert.equal(isReachableStatus(500), false)
  assert.equal(isReachableStatus(503), false)
  assert.equal(isReachableStatus(null), false)
})

test('social ping monitors the six agreed platforms', () => {
  assert.deepEqual(
    SOCIAL_PLATFORMS.map((platform) => platform.id),
    ['instagram', 'facebook', 'tiktok', 'whatsapp', 'youtube', 'x'],
  )
})
