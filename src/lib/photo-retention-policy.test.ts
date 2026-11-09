import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPhotoRetentionCutoff } from './photo-retention-policy'

describe('getPhotoRetentionCutoff', () => {
  it('subtracts six calendar months and preserves the UTC time', () => {
    const now = new Date('2026-11-09T12:34:56.000Z')

    assert.equal(
      getPhotoRetentionCutoff(now).toISOString(),
      '2026-05-09T12:34:56.000Z',
    )
  })

  it('clamps to the last day of the target month', () => {
    const now = new Date('2026-08-31T08:00:00.000Z')

    assert.equal(
      getPhotoRetentionCutoff(now).toISOString(),
      '2026-02-28T08:00:00.000Z',
    )
  })

  it('supports leap-year month ends', () => {
    const now = new Date('2024-08-31T08:00:00.000Z')

    assert.equal(
      getPhotoRetentionCutoff(now).toISOString(),
      '2024-02-29T08:00:00.000Z',
    )
  })

  it('rejects an invalid reference date', () => {
    assert.throws(() => getPhotoRetentionCutoff(new Date(Number.NaN)))
  })
})
