import { NextResponse } from 'next/server'
import { Prisma as PrismaSql } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureNetworkPingTableOnce } from '@/lib/network-ping-db'
import { ensureOdpTable } from '@/lib/odp-init'
import { getNocPopStatus, getProbeAvailability } from '@/lib/noc-dashboard'

export const dynamic = 'force-dynamic'

type PopMonitorRow = {
  id: number
  nama_pop: string
  results: boolean[] | null
  last_checked_at: Date | null
  latest_latency_ms: number | null
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
    await ensureOdpTable()
    await ensureNetworkPingTableOnce()
    const now = new Date()
    const hourMs = 60 * 60 * 1000
    const bucketStartMs = Math.floor(now.getTime() / hourMs) * hourMs - 23 * hourMs
    const bucketStart = new Date(bucketStartMs)

    const [popRows, probeHours, incidentCounts, latestIncidents] = await Promise.all([
      prisma.$queryRaw<PopMonitorRow[]>(PrismaSql.sql`
        SELECT
          p.id,
          p.nama_pop,
          recent.results,
          recent.last_checked_at,
          recent.latest_latency_ms
        FROM psb_pop p
        LEFT JOIN LATERAL (
          SELECT
            ARRAY_AGG(samples.success ORDER BY samples.checked_at DESC) AS results,
            MAX(samples.checked_at) AS last_checked_at,
            (ARRAY_AGG(samples.latency_ms ORDER BY samples.checked_at DESC))[1] AS latest_latency_ms
          FROM (
            SELECT success, checked_at, latency_ms
            FROM network_ping_results
            WHERE pop_id = p.id
            ORDER BY checked_at DESC
            LIMIT 2
          ) samples
        ) recent ON TRUE
        WHERE p.is_active IS NOT FALSE
          AND NULLIF(TRIM(p.ip_address), '') IS NOT NULL
        ORDER BY p.nama_pop ASC
      `),
      prisma.$queryRaw<ProbeHourRow[]>(PrismaSql.sql`
        SELECT
          date_trunc('hour', r.checked_at) AS hour,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE r.success)::int AS successful,
          SUM(r.latency_ms) FILTER (WHERE r.success AND r.latency_ms IS NOT NULL)::float8 AS latency_sum,
          COUNT(r.latency_ms) FILTER (WHERE r.success)::int AS latency_count
        FROM network_ping_results r
        INNER JOIN psb_pop p ON p.id = r.pop_id
        WHERE p.is_active IS NOT FALSE
          AND NULLIF(TRIM(p.ip_address), '') IS NOT NULL
          AND r.checked_at >= ${bucketStart}
          AND r.checked_at <= ${now}
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
            WHERE UPPER(TRIM(COALESCE(category, 'TT'))) = 'PV'
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

    const pops = popRows.map((pop) => {
      const samples = (pop.results ?? []).map((success) => ({
        success,
        checkedAt: pop.last_checked_at ?? now,
      }))
      const status = getNocPopStatus(samples, now)
      return {
        id: pop.id,
        name: pop.nama_pop,
        status,
        latestCheckedAt: pop.last_checked_at,
        latencyMs: pop.latest_latency_ms,
      }
    })

    const statusSummary = {
      up: pops.filter((pop) => pop.status === 'UP').length,
      warning: pops.filter((pop) => pop.status === 'WARNING').length,
      down: pops.filter((pop) => pop.status === 'DOWN').length,
      unknown: pops.filter((pop) => pop.status === 'UNKNOWN').length,
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
    const lastCheckedAt = pops.reduce<Date | null>((latest, pop) => {
      if (!pop.latestCheckedAt) return latest
      if (!latest || pop.latestCheckedAt > latest) return pop.latestCheckedAt
      return latest
    }, null)
    const counts = incidentCounts[0] ?? { trouble_active: 0, preventive_active: 0 }

    return NextResponse.json(
      {
        generatedAt: now.toISOString(),
        network: {
          popTotal: pops.length,
          statusSummary,
          availabilityPercent: getProbeAvailability(successfulChecks, totalChecks),
          avgLatencyMs: latencyCount > 0 ? latencySum / latencyCount : null,
          lastCheckedAt,
          pops,
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
