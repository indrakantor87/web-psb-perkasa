import assert from 'node:assert/strict'
import test from 'node:test'
import { getFocusedIntegerAxisDomain } from './chart-axis'

test('focuses customer totals around the reported values', () => {
  assert.deepEqual(getFocusedIntegerAxisDomain([3693, 3714, 3741, 3750]), [3680, 3760])
})

test('keeps a small margin around active customer values', () => {
  assert.deepEqual(getFocusedIntegerAxisDomain([314, 317, 339]), [310, 345])
})

test('returns no domain for empty or non-finite values', () => {
  assert.equal(getFocusedIntegerAxisDomain([]), undefined)
  assert.equal(getFocusedIntegerAxisDomain([Number.NaN, Number.POSITIVE_INFINITY]), undefined)
})

test('keeps a non-zero domain for constant values', () => {
  assert.deepEqual(getFocusedIntegerAxisDomain([3700, 3700]), [3650, 3750])
})
