import assert from 'node:assert/strict'
import test from 'node:test'
import { userUpdateSchema } from '@/lib/validations'
import { HR_DIVISIONS } from '@/lib/hr-departments'

test('user update accepts every HR division', () => {
  for (const division of HR_DIVISIONS) {
    const result = userUpdateSchema.safeParse({ id: 12, division })
    assert.equal(result.success, true, `${division} should be accepted`)
  }
})

test('user update accepts clearing a division', () => {
  const result = userUpdateSchema.safeParse({ id: 12, division: null })
  assert.equal(result.success, true)
})

test('user update rejects unsupported division values', () => {
  const result = userUpdateSchema.safeParse({ id: 12, division: 'NOC_TROUBLESHOOTS' })
  assert.equal(result.success, false)
})
