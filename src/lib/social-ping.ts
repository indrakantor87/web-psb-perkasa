import { prisma } from '@/lib/prisma'
import { Prisma as PrismaSql } from '@prisma/client'
import { ensureSocialPingTableOnce } from '@/lib/social-ping-db'

/**
 * Target probe media sosial. Endpoint dipilih agar cukup ringan (hanya HEAD/GET
 * ke halaman utama) dan tidak membebani server pemantau maupun layanan target.
 */
export const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/' },
  { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/' },
  { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/' },
  { id: 'whatsapp', label: 'WhatsApp', url: 'https://web.whatsapp.com/' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/' },
  { id: 'x', label: 'X', url: 'https://x.com/' },
] as const

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; PSB-NetworkMonitor/1.0; +https://webpsb.perkasa.net.id/)'

const RETENTION_DAYS = 45

export type SocialPingOutcome = {
  platform: string
  label: string
  endpointUrl: string
  success: boolean
  statusCode: number | null
  latencyMs: number | null
  error: string | null
}

/**
 * Layanan dianggap terjangkau bila server menjawab HTTP apa pun di bawah 5xx.
 * Status 4xx (mis. 403 dari proteksi bot) tetap berarti jalur jaringan sehat,
 * sehingga tidak memicu alarm palsu.
 */
export function isReachableStatus(statusCode: number | null): boolean {
  return statusCode != null && statusCode < 500
}

type ProbeResult = {
  success: boolean
  statusCode: number | null
  latencyMs: number | null
  error: string | null
}

async function requestOnce(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
): Promise<{ status: number; latencyMs: number }> {
  const start = Date.now()
  const response = await fetch(url, {
    method,
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': DEFAULT_USER_AGENT, accept: '*/*' },
  })
  const latencyMs = Date.now() - start
  try {
    await response.body?.cancel()
  } catch {
    // Body sudah tidak diperlukan; kegagalan membatalkan stream dapat diabaikan.
  }
  return { status: response.status, latencyMs }
}

async function probeEndpoint(url: string, timeoutMs: number): Promise<ProbeResult> {
  try {
    let result = await requestOnce(url, 'HEAD', timeoutMs)
    if (result.status === 405 || result.status === 501) {
      result = await requestOnce(url, 'GET', timeoutMs)
    }

    const success = isReachableStatus(result.status)
    return {
      success,
      statusCode: result.status,
      latencyMs: result.latencyMs,
      error: success ? null : `HTTP ${result.status}`,
    }
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return {
      success: false,
      statusCode: null,
      latencyMs: null,
      error: timedOut
        ? `Timeout setelah ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : 'Tidak dapat menghubungi layanan',
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++
        results[index] = await mapper(items[index])
      }
    }),
  )

  return results
}

export async function runSocialPing(timeoutMs = 5000, concurrency = 3): Promise<SocialPingOutcome[]> {
  const safeTimeoutMs = Math.min(15000, Math.max(2000, Math.round(timeoutMs) || 5000))
  const safeConcurrency = Math.min(6, Math.max(1, Math.trunc(concurrency) || 3))

  const outcomes = await mapWithConcurrency(SOCIAL_PLATFORMS, safeConcurrency, async (platform) => {
    const result = await probeEndpoint(platform.url, safeTimeoutMs)
    return {
      platform: platform.id,
      label: platform.label,
      endpointUrl: platform.url,
      success: result.success,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      error: result.error,
    }
  })

  await ensureSocialPingTableOnce()
  if (outcomes.length > 0) {
    const values = outcomes
      .map(
        (o) =>
          PrismaSql.sql`(${o.platform}, ${o.label}, ${o.endpointUrl}, ${o.success}, ${o.statusCode ?? null}, ${o.latencyMs ?? null}, ${o.error ?? null})`,
      )
      .reduce((acc, v, i) => (i === 0 ? PrismaSql.sql`${v}` : PrismaSql.sql`${acc}, ${v}`))
    await prisma.$executeRaw(PrismaSql.sql`
      INSERT INTO "social_ping_results"
        ("platform", "label", "endpoint_url", "success", "status_code", "latency_ms", "error")
      VALUES ${values}
    `)
  }

  await pruneSocialPingResults()
  return outcomes
}

let lastRetentionCleanupDay: string | null = null

async function pruneSocialPingResults() {
  const today = new Date().toISOString().slice(0, 10)
  if (lastRetentionCleanupDay === today) return

  await prisma.$executeRaw(PrismaSql.sql`
    DELETE FROM "social_ping_results"
    WHERE "checked_at" < NOW() - ${`${RETENTION_DAYS} days`}::interval
  `)
  lastRetentionCleanupDay = today
}

export type SocialAvailabilityResult = {
  availabilityPercent: number
  totalChecks: number
  successfulChecks: number
  avgLatencyMs: number | null
  downtimeMinutes: number
  lastCheckedAt: Date | null
  byPlatform: Array<{
    platform: string
    label: string
    availabilityPercent: number
    totalChecks: number
    successfulChecks: number
    lastSuccessAt: Date | null
    lastFailureAt: Date | null
    currentStatus: 'UP' | 'DOWN' | 'UNKNOWN'
  }>
}

type PingRow = {
  platform: string
  label: string
  success: boolean
  latency_ms: number | null
  checked_at: Date
}

export async function getSocialAvailability(
  from: Date,
  to: Date,
): Promise<SocialAvailabilityResult> {
  await ensureSocialPingTableOnce()
  const rows = await prisma.$queryRaw<PingRow[]>(PrismaSql.sql`
    SELECT platform, label, success, latency_ms, checked_at
    FROM social_ping_results
    WHERE checked_at >= ${from} AND checked_at <= ${to}
    ORDER BY checked_at ASC
  `)

  const byPlatformMap = new Map<string, PingRow[]>()
  for (const r of rows) {
    const arr = byPlatformMap.get(r.platform) ?? []
    arr.push(r)
    byPlatformMap.set(r.platform, arr)
  }

  const byPlatform: SocialAvailabilityResult['byPlatform'] = []
  let totalChecks = 0
  let successfulChecks = 0
  let totalLatency = 0
  let latencyCount = 0
  let lastCheckedAt: Date | null = null

  for (const [platform, platformRows] of byPlatformMap) {
    const successCount = platformRows.filter((r) => r.success).length
    const platformTotal = platformRows.length
    const availabilityPercent = platformTotal > 0 ? (successCount / platformTotal) * 100 : 0
    const lastSuccess = platformRows.filter((r) => r.success).pop()
    const lastFailure = platformRows.filter((r) => !r.success).pop()
    const lastRow = platformRows[platformRows.length - 1]
    const currentStatus = lastRow ? (lastRow.success ? 'UP' : 'DOWN') : 'UNKNOWN'
    byPlatform.push({
      platform,
      label: platformRows[0].label,
      availabilityPercent,
      totalChecks: platformTotal,
      successfulChecks: successCount,
      lastSuccessAt: lastSuccess?.checked_at ?? null,
      lastFailureAt: lastFailure?.checked_at ?? null,
      currentStatus,
    })
    totalChecks += platformTotal
    successfulChecks += successCount
    for (const r of platformRows) {
      if (r.latency_ms != null) {
        totalLatency += r.latency_ms
        latencyCount += 1
      }
    }
    if (!lastCheckedAt || (lastRow && lastRow.checked_at > lastCheckedAt)) {
      lastCheckedAt = lastRow?.checked_at ?? null
    }
  }

  const availabilityPercent = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0
  const failedChecks = totalChecks - successfulChecks
  const windowMinutes = Math.max(1, (to.getTime() - from.getTime()) / 60000)
  const downtimeMinutes = totalChecks > 0 ? (failedChecks / totalChecks) * windowMinutes : 0

  return {
    availabilityPercent,
    totalChecks,
    successfulChecks,
    avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : null,
    downtimeMinutes,
    lastCheckedAt,
    byPlatform,
  }
}
