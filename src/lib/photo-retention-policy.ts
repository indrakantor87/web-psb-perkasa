export const OPERATIONAL_PHOTO_RETENTION_MONTHS = 6
export const PHOTO_RETENTION_BATCH_SIZE = 250
export const PHOTO_RETENTION_MAX_BATCHES = 4

export function getPhotoRetentionCutoff(now = new Date()) {
  if (Number.isNaN(now.getTime())) {
    throw new Error('Invalid retention reference date')
  }

  const cutoff = new Date(now)
  const originalDay = cutoff.getUTCDate()
  cutoff.setUTCDate(1)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - OPERATIONAL_PHOTO_RETENTION_MONTHS)

  const lastTargetDay = new Date(
    Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0),
  ).getUTCDate()
  cutoff.setUTCDate(Math.min(originalDay, lastTargetDay))

  return cutoff
}
