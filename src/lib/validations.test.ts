import assert from 'node:assert/strict'
import test from 'node:test'
import { userUpdateSchema } from '@/lib/validations'

test('user update accepts a supported division', () => {
  const result = userUpdateSchema.safeParse({ id: 12, division: 'NOC_TROUBLESHOOTS' })
  assert.equal(result.success, true)
})

test('user update accepts clearing a division', () => {
  const result = userUpdateSchema.safeParse({ id: 12, division: null })
  assert.equal(result.success, true)
})

test('user update rejects unsupported division values', () => {
  const result = userUpdateSchema.safeParse({ id: 12, division: 'ALL' })
  assert.equal(result.success, false)
})
