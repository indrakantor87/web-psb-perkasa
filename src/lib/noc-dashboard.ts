export type NocProbeSample = {
  success: boolean
  checkedAt: Date | string
}

export type NocPopStatus = 'UP' | 'WARNING' | 'DOWN' | 'UNKNOWN'

const NOC_PROBE_STALE_AFTER_MS = 3 * 60 * 1000

export function getNocPopStatus(
  latestFirstSamples: readonly NocProbeSample[],
  now = new Date(),
): NocPopStatus {
  const latest = latestFirstSamples[0]
  if (!latest) return 'UNKNOWN'

  const ageMs = now.getTime() - new Date(latest.checkedAt).getTime()
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > NOC_PROBE_STALE_AFTER_MS) {
    return 'UNKNOWN'
  }

  if (
    latestFirstSamples.length >= 2 &&
    !latestFirstSamples[0].success &&
    !latestFirstSamples[1].success
  ) {
    return 'DOWN'
  }

  return latest.success ? 'UP' : 'WARNING'
}

export function getProbeAvailability(successfulChecks: number, totalChecks: number) {
  if (totalChecks <= 0) return null
  return (successfulChecks / totalChecks) * 100
}
