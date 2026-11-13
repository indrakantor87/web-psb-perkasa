export type ProbeSample = {
  success: boolean
  checkedAt: Date | string
}

export type ProbeStatus = 'UP' | 'WARNING' | 'DOWN' | 'UNKNOWN'

// Probe berjalan tiap 5 menit; data dianggap stale setelah 3 kali interval terlewat.
export const PROBE_STALE_AFTER_MS = 15 * 60 * 1000

export function getProbeStatus(
  latestFirstSamples: readonly ProbeSample[],
  now = new Date(),
): ProbeStatus {
  const latest = latestFirstSamples[0]
  if (!latest) return 'UNKNOWN'

  const ageMs = now.getTime() - new Date(latest.checkedAt).getTime()
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > PROBE_STALE_AFTER_MS) {
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
