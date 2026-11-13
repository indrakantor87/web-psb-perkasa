import { NextResponse } from 'next/server'
import { Prisma as PrismaSql } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSocialPingTableOnce } from '@/lib/social-ping-db'
import { SOCIAL_PLATFORMS } from '@/lib/social-ping'
import { ensureOdpTable } from '@/lib/odp-init'
import { getProbeStatus, getProbeAvailability } from '@/lib/noc-dashboard'

export const dynamic = 'force-dynamic'

type PlatformMonitorRow = {
  platform: string
  label: string
  results: boolean[] | null
  last_checked_at: Date | null
  latest_latency_ms: number | null
  latest_status_code: number | null
}

type ProbeHourRow = {
  hour: Date
  total: number
  successful: number
  latency_sum: number | null
  latency_count: number
}

type IncidentCounts = {
  trouble_active: number
  preventive_active: number
}

type IncidentRow = {
  id: number
  ticketCode: string | null
  category: string
  type: string
  status: string
  problemCategory: string | null
  openedAt: Date
}

export async function GET() {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (String(session.user.role ?? '').trim().toUpperCase() !== 'NOC') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await Promise.all([ensureOdpTable(), ensureSocialPingTableOnce()])
    const now = new Date()
    const hourMs = 60 * 60 * 1000
    const bucketStartMs = Math.floor(now.getTime() / hourMs) * hourMs - 23 * hourMs
    const bucketStart = new Date(bucketStartMs)

    const [platformRows, probeHours, incidentCounts, latestIncidents] = await Promise.all([
      prisma.$queryRaw<PlatformMonitorRow[]>(PrismaSql.sql`
        SELECT
          ranked.platform,
          (ARRAY_AGG(ranked.label ORDER BY ranked.checked_at DESC))[1] AS label,
          ARRAY_AGG(ranked.success ORDER BY ranked.checked_at DESC) AS results,
          MAX(ranked.checked_at) AS last_checked_at,
          (ARRAY_AGG(ranked.latency_ms ORDER BY ranked.checked_at DESC))[1] AS latest_latency_ms,
          (ARRAY_AGG(ranked.status_code ORDER BY ranked.checked_at DESC))[1] AS latest_status_code
        FROM (
          SELECT
            platform,
            label,
            success,
            latency_ms,
            status_code,
            checked_at,
            ROW_NUMBER() OVER (PARTITION BY platform ORDER BY checked_at DESC) AS rn
          FROM social_ping_results
          WHERE checked_at >= NOW() - INTERVAL '7 days'
        ) ranked
        WHERE ranked.rn <= 2
        GROUP BY ranked.platform
      `),
      prisma.$queryRaw<ProbeHourRow[]>(PrismaSql.sql`
        SELECT
          date_trunc('hour', checked_at) AS hour,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE success)::int AS successful,
          SUM(latency_ms) FILTER (WHERE success AND latency_ms IS NOT NULL)::float8 AS latency_sum,
          COUNT(latency_ms) FILTER (WHERE success)::int AS latency_count
        FROM social_ping_results
        WHERE checked_at >= ${bucketStart}
          AND checked_at <= ${now}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      prisma.$queryRaw<IncidentCounts[]>(PrismaSql.sql`
        SELECT
          COUNT(*) FILTER (
            WHERE UPPER(TRIM(COALESCE(category, 'TT'))) <> 'PV'
              AND UPPER(TRIM(COALESCE(type, ''))) <> 'PREVENTIVE'
          )::int AS trouble_active,
          COUNT(*) FILTER (
            WHERE UPPER(TRIM(COALESCE(category, 'PV'))) = 'PV'
              OR UPPER(TRIM(COALESCE(type, ''))) = 'PREVENTIVE'
          )::int AS preventive_active
        FROM "TroubleTicket"
        WHERE "closedAt" IS NULL
      `),
      prisma.$queryRaw<IncidentRow[]>(PrismaSql.sql`
        SELECT
          id,
          "ticketCode",
          category,
          type,
          status,
          "problemCategory",
          "openedAt"
        FROM "TroubleTicket"
        WHERE "closedAt" IS NULL
        ORDER BY "openedAt" DESC
        LIMIT 8
      `),
    ])

    const platformMap = new Map(platformRows.map((row) => [row.platform, row]))
    const platforms = SOCIAL_PLATFORMS.map((platform) => {
      const row = platformMap.get(platform.id)
      const samples = (row?.results ?? []).map((success) => ({
        success,
        checkedAt: row?.last_checked_at ?? now,
      }))
      return {
        id: platform.id,
        label: platform.label,
        url: platform.url,
        status: getProbeStatus(samples, now),
        latestCheckedAt: row?.last_checked_at ?? null,
        latencyMs: row?.latest_latency_ms ?? null,
        statusCode: row?.latest_status_code ?? null,
      }
    })

    const statusSummary = {
      up: platforms.filter((platform) => platform.status === 'UP').length,
      warning: platforms.filter((platform) => platform.status === 'WARNING').length,
      down: platforms.filter((platform) => platform.status === 'DOWN').length,
      unknown: platforms.filter((platform) => platform.status === 'UNKNOWN').length,
    }

    const byHour = new Map(
      probeHours.map((row) => [Math.floor(new Date(row.hour).getTime() / hourMs) * hourMs, row]),
    )
    const series = Array.from({ length: 24 }, (_, index) => {
      const hour = new Date(bucketStartMs + index * hourMs)
      const row = byHour.get(hour.getTime())
      return {
        hour: hour.toISOString(),
        availabilityPercent: row ? getProbeAvailability(row.successful, row.total) : null,
        latencyMs: row && row.latency_count > 0
          ? Number(row.latency_sum ?? 0) / row.latency_count
          : null,
      }
    })

    const totalChecks = probeHours.reduce((sum, row) => sum + row.total, 0)
    const successfulChecks = probeHours.reduce((sum, row) => sum + row.successful, 0)
    const latencyCount = probeHours.reduce((sum, row) => sum + row.latency_count, 0)
    const latencySum = probeHours.reduce((sum, row) => sum + Number(row.latency_sum ?? 0), 0)
    const lastCheckedAt = platforms.reduce<Date | null>((latest, platform) => {
      if (!platform.latestCheckedAt) return latest
      if (!latest || platform.latestCheckedAt > latest) return platform.latestCheckedAt
      return latest
    }, null)
    const counts = incidentCounts[0] ?? { trouble_active: 0, preventive_active: 0 }

    return NextResponse.json(
      {
        generatedAt: now.toISOString(),
        network: {
          platformTotal: platforms.length,
          statusSummary,
          availabilityPercent: getProbeAvailability(successfulChecks, totalChecks),
          avgLatencyMs: latencyCount > 0 ? latencySum / latencyCount : null,
          lastCheckedAt,
          platforms,
          series,
        },
        incidents: {
          troubleActive: counts.trouble_active,
          preventiveActive: counts.preventive_active,
          totalActive: counts.trouble_active + counts.preventive_active,
          latest: latestIncidents,
        },
        telemetry: {
          traffic: { available: false, label: 'Menunggu integrasi RouterOS' },
          pppoe: { available: false, label: 'Menunggu verifikasi sumber sesi PPPoE' },
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[api/noc-dashboard] Failed to load NOC dashboard data', error)
    return NextResponse.json({ error: 'Gagal memuat data dashboard NOC' }, { status: 500 })
  }
}
