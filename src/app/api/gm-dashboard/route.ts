import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma as PrismaSql } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { canReadGmDailyReport } from '@/lib/gm-daily-report-access'
import { isMarketingServiceManager } from '@/lib/access'
import { JAKARTA_OFFSET_MS, jakartaNow } from '@/lib/jakarta-time'
import {
  getGmDashboardPeriodLabel,
  getGmDashboardPeriodRange,
  getGmDashboardQueryRange,
  resolveGmDashboardPeriod,
} from '@/lib/gm-dashboard-period'
import { ensureOdpTable } from '@/lib/odp-init'
import { ensureGmDailyReportTableOnce } from '@/lib/gm-daily-report-db'
import { getSocialAvailability } from '@/lib/social-ping'
import { getMarketingNameMap, marketingNameKey, toDashboardMarketingLabel } from '@/lib/marketing-users'

export const dynamic = 'force-dynamic'

type DivisionRow = {
  code: string
  label: string
  primaryValue: number
  primaryLabel: string
  valueSuffix?: string
  secondaryValue: number
  secondaryLabel: string
  secondarySuffix?: string
  progress: number
  members: number
}

type DailyCountRow = { date: string; count: number }
type ServiceTicketStatusRow = { status: string; count: number }
type ServiceSubdivisionRow = { subdivision: string; total: number; done: number }
type RecentServiceActivityRow = {
  id: number
  activityDate: Date
  subdivision: string | null
  ownerName: string
  title: string
  executionStatus: string
}

function pct(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (
    !canReadGmDailyReport(session.user.role) &&
    !isMarketingServiceManager(session.user.role, session.user.position, session.user.division)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const now = jakartaNow()
  const { year, month } = resolveGmDashboardPeriod(url.searchParams, now)
  const requestedTrendDays = Number(url.searchParams.get('trendDays'))
  const trendDays = [7, 30, 90].includes(requestedTrendDays) ? requestedTrendDays : 30
  const trendEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - JAKARTA_OFFSET_MS)
  const trendStart = new Date(trendEnd.getTime() - trendDays * 24 * 60 * 60 * 1000)
  const periodLabel = getGmDashboardPeriodLabel(year, month)
  const { start: periodStart, end: periodEnd, hasStarted: periodHasStarted } =
    getGmDashboardQueryRange(year, month)
  const { start: comparisonStart, end: comparisonEnd } = getGmDashboardPeriodRange(year - 1, month)
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1))
  const yearMonthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const daysInPeriod = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dayLabels = Array.from({ length: daysInPeriod }, (_, index) => String(index + 1).padStart(2, '0'))
  const isCurrentPeriod = now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month
  const carryClause = isCurrentPeriod
    ? PrismaSql.sql`OR ("installedDate" IS NULL AND "status" IN ('OPEN', 'ON_PROGRESS') AND "requestDate" < ${periodEnd})`
    : PrismaSql.sql``
  const marketingNameMap = await getMarketingNameMap().catch(() => new Map<string, string>())

  await Promise.all([ensureGmDailyReportTableOnce().catch(() => {}), ensureOdpTable().catch(() => {})])

  const [
    psbInstalled,
    psbInstalledLY,
    ttOpened,
    ttClosed,
    avgMttrRows,
    isolationNew,
    isolationRestored,
    snapshotPeriodRows,
    snapshotComparisonRows,
    troubleDailyRows,
    packageRows,
    odpStatsRows,
    popCount,
    activeEmployees,
    attendancePeriodRows,
    dailyActivityRows,
    slaBreachRows,
    isolirOverdueRows,
    dismantleBacklogRows,
    employeeDivisionRows,
    marketingRows,
    isolirMarketingRows,
  ] = await Promise.all([
    prisma.ticket.count({ where: { installedDate: { gte: periodStart, lt: periodEnd } } }).catch(() => 0),
    prisma.ticket.count({ where: { installedDate: { gte: comparisonStart, lt: comparisonEnd } } }).catch(() => 0),
    prisma.troubleTicket.count({ where: { openedAt: { gte: periodStart, lt: periodEnd } } }).catch(() => 0),
    prisma.troubleTicket.count({ where: { closedAt: { gte: periodStart, lt: periodEnd } } }).catch(() => 0),
    prisma.$queryRaw<Array<{ avg_hours: number | null }>>(PrismaSql.sql`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("closedAt" - "openedAt")) / 3600)::numeric, 1) AS avg_hours
      FROM "TroubleTicket"
      WHERE "closedAt" >= ${periodStart} AND "closedAt" < ${periodEnd}
    `).catch(() => []),
    prisma.isolation.count({ where: { isolationDate: { gte: periodStart, lt: periodEnd } } }).catch(() => 0),
    prisma.isolation.count({ where: { restorationDate: { gte: periodStart, lt: periodEnd } } }).catch(() => 0),
    prisma.$queryRaw<Array<{ reportDate: Date; totalCustomers: number; activeCustomers: number; customerDeclinePercent: number; isolationContinued: number; isolationNotContinued: number; installationQueue: number; dismantleOpen: number; dismantleClosed: number }>>(PrismaSql.sql`
      SELECT "reportDate", "totalCustomers", "activeCustomers", "customerDeclinePercent", "isolationContinued", "isolationNotContinued", "installationQueue", "dismantleOpen", "dismantleClosed"
      FROM "gm_daily_report_snapshots"
      WHERE "reportDate" >= ${periodStart} AND "reportDate" < ${periodEnd}
      ORDER BY "reportDate" ASC
    `).catch(() => []),
    prisma.$queryRaw<Array<{ totalCustomers: number; activeCustomers: number }>>(PrismaSql.sql`
      SELECT "totalCustomers", "activeCustomers"
      FROM "gm_daily_report_snapshots"
      WHERE "reportDate" >= ${comparisonStart} AND "reportDate" < ${comparisonEnd}
      ORDER BY "reportDate" DESC
      LIMIT 1
    `).catch(() => []),
    prisma.$queryRaw<Array<{ day: number; problemCategory: string; count: number }>>(PrismaSql.sql`
      SELECT
        EXTRACT(DAY FROM ("openedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'))::int AS day,
        COALESCE(NULLIF(TRIM(UPPER("problemCategory")), ''), 'UNKNOWN') AS "problemCategory",
        COUNT(*)::int AS count
      FROM "TroubleTicket"
      WHERE "openedAt" >= ${periodStart} AND "openedAt" < ${periodEnd}
        AND COALESCE(NULLIF(TRIM("category"), ''), 'TT') = 'TT'
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `).catch(() => []),
    prisma.$queryRaw<Array<{ name: string; count: number }>>(PrismaSql.sql`
      WITH src AS (
        SELECT CASE
          WHEN UPPER("package") LIKE '%HOME LITE%' THEN 'HOME LITE'
          WHEN UPPER("package") LIKE '%HOME BASIC%' THEN 'HOME BASIC'
          WHEN UPPER("package") LIKE '%HOME STREAM%' THEN 'HOME STREAM'
          WHEN UPPER("package") LIKE '%HOME ENTERTAIN%' THEN 'HOME ENTERTAIN'
          WHEN UPPER("package") LIKE '%HOME SMALL%' THEN 'HOME SMALL'
          WHEN UPPER("package") LIKE '%HOME ADVAN%' THEN 'HOME ADVAN'
          ELSE COALESCE("package", 'Unknown')
        END AS name
        FROM "Ticket"
        WHERE "installedDate" >= ${periodStart} AND "installedDate" < ${periodEnd}
      )
      SELECT name, COUNT(*)::int AS count
      FROM src
      GROUP BY name
      ORDER BY count DESC
    `).catch(() => []),
    (async () => {
      try {
        return await prisma.$queryRaw<Array<{ total: number; kapasitas: number; terpakai: number }>>(PrismaSql.sql`
          SELECT
            COUNT(*)::int AS total,
            COALESCE(SUM("kapasitas"), 0)::int AS kapasitas,
            COALESCE(SUM("terpakai"), 0)::int AS terpakai
          FROM psb_odp
          WHERE is_active = TRUE
        `)
      } catch {
        return []
      }
    })(),
    prisma.pop.count({ where: { is_active: true } }).catch(() => 0),
    prisma.employee.count({ where: { isActive: true } }).catch(() => 0),
    (async () => {
      try {
        return await prisma.$queryRaw<Array<{ average_present: number; attendance_days: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(ROUND(AVG(daily.present)), 0)::int AS average_present,
            COUNT(*)::int AS attendance_days
          FROM (
            SELECT
              DATE("date" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') AS attendance_date,
              COUNT(*) FILTER (WHERE "checkIn" IS NOT NULL)::int AS present
            FROM "Attendance"
            WHERE "date" >= ${periodStart} AND "date" < ${periodEnd}
            GROUP BY 1
          ) AS daily
        `)
      } catch {
        return []
      }
    })(),
    prisma.$queryRaw<Array<{ division: string; total: number; done: number }>>(PrismaSql.sql`
      SELECT
        COALESCE(NULLIF(TRIM("division"), ''), 'Tanpa Divisi') AS division,
        COUNT(*)::int AS total,
        SUM(CASE WHEN "executionStatus" = 'DONE' THEN 1 ELSE 0 END)::int AS done
      FROM "psb_daily_activity_items"
      WHERE "activityDate" >= ${periodStart} AND "activityDate" < ${periodEnd}
      GROUP BY 1
      ORDER BY total DESC
    `).catch(() => []),
    prisma.$queryRaw<Array<{ id: number; ticketCode: string; customerName: string; type: string; openedAt: Date }>>(PrismaSql.sql`
      SELECT "id", "ticketCode", "customerName", "type", "openedAt"
      FROM "TroubleTicket"
      WHERE "closedAt" IS NULL
        AND "openedAt" < NOW() - INTERVAL '2 hours'
        AND COALESCE(NULLIF(TRIM(UPPER("type")), ''), 'MINOR') IN ('EMERGENCY', 'MAJOR', 'MINOR')
      ORDER BY "openedAt" ASC
      LIMIT 50
    `).catch(() => []),
    prisma.$queryRaw<Array<{ id: number; customerName: string; isolationDate: Date; marketing: string }>>(PrismaSql.sql`
      SELECT "id", "customerName", "isolationDate", COALESCE(NULLIF(TRIM("marketing"), ''), 'Unknown') AS marketing
      FROM "Isolation"
      WHERE "status" = 'OPEN'
        AND "isolationDate" < NOW() - INTERVAL '30 days'
      ORDER BY "isolationDate" ASC
      LIMIT 50
    `).catch(() => []),
    prisma.$queryRaw<Array<{ count: number }>>(PrismaSql.sql`
      SELECT COUNT(*)::int AS count
      FROM "Isolation"
      WHERE "status" = 'OPEN'
        AND COALESCE(TRIM("ticketDismantle"), '') <> ''
    `).catch(() => []),
    prisma.$queryRaw<Array<{ department: string; count: number }>>(PrismaSql.sql`
      SELECT
        COALESCE(NULLIF(TRIM("department"), ''), 'Pemasaran dan Pelayanan') AS department,
        COUNT(*)::int AS count
      FROM "Employee"
      WHERE "isActive" = TRUE
      GROUP BY 1
    `).catch(() => []),
    prisma.$queryRaw<Array<{ name: string; count: number; open: number; on_progress: number; close: number }>>(PrismaSql.sql`
      SELECT
        COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown') AS name,
        COUNT(*)::int AS count,
        SUM(CASE WHEN UPPER(TRIM("status")) = 'OPEN' THEN 1 ELSE 0 END)::int AS open,
        SUM(CASE WHEN UPPER(TRIM("status")) IN ('ON_PROGRESS', 'PENDING') THEN 1 ELSE 0 END)::int AS on_progress,
        SUM(CASE WHEN UPPER(TRIM("status")) = 'CLOSE' THEN 1 ELSE 0 END)::int AS close
      FROM "Ticket"
      WHERE (
        ("installedDate" IS NOT NULL AND "installedDate" >= ${periodStart} AND "installedDate" < ${periodEnd})
        ${carryClause}
      )
      GROUP BY COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown')
      ORDER BY SUM(CASE WHEN UPPER(TRIM("status")) = 'CLOSE' THEN 1 ELSE 0 END) DESC
    `).catch(() => []),
    prisma.$queryRaw<Array<{ name: string; count: number }>>(PrismaSql.sql`
      SELECT COALESCE(NULLIF(TRIM("marketing"), ''), 'Unknown') AS name, COUNT(*)::int AS count
      FROM "Isolation"
      WHERE "status" = 'OPEN'
      GROUP BY COALESCE(NULLIF(TRIM("marketing"), ''), 'Unknown')
    `).catch(() => []),
  ])

  const managerDashboardData = isMarketingServiceManager(
    session.user.role,
    session.user.position,
    session.user.division
  )
    ? await Promise.all([
    prisma.ticket.count({ where: { requestDate: { gte: periodStart, lt: periodEnd } } }).catch(() => 0),
    prisma.troubleTicket.count({ where: { closedAt: null } }).catch(() => 0),
    prisma.$queryRaw<Array<{ status: string; count: number }>>(PrismaSql.sql`
      SELECT UPPER(COALESCE(NULLIF(TRIM("status"), ''), 'OPEN')) AS status, COUNT(*)::int AS count
      FROM "Ticket"
      WHERE "requestDate" >= ${periodStart} AND "requestDate" < ${periodEnd}
      GROUP BY 1
    `).catch(() => []),
    prisma.contentCalendar.count({
      where: { status: 'PUBLISHED', publishDate: { gte: periodStart, lt: periodEnd } },
    }).catch(() => 0),
    prisma.contentCalendar.count({
      where: { status: 'SCHEDULED', publishDate: { gte: periodStart, lt: periodEnd } },
    }).catch(() => 0),
    prisma.digitalLead.count({ where: { createdAt: { gte: periodStart, lt: periodEnd } } }).catch(() => 0),
    prisma.$queryRaw<Array<{ subdivision: string; total: number; done: number }>>(PrismaSql.sql`
      SELECT
        COALESCE(NULLIF(TRIM("subdivision"), ''), 'Tanpa Subdivisi') AS subdivision,
        COUNT(*)::int AS total,
        SUM(CASE WHEN "executionStatus" = 'DONE' THEN 1 ELSE 0 END)::int AS done
      FROM "psb_daily_activity_items"
      WHERE "division" = 'Pemasaran dan Pelayanan'
        AND "activityDate" >= ${periodStart} AND "activityDate" < ${periodEnd}
      GROUP BY 1
      ORDER BY total DESC
    `).catch(() => []),
    prisma.dailyActivityItem.findMany({
      where: {
        division: 'Pemasaran dan Pelayanan',
        activityDate: { gte: periodStart, lt: periodEnd },
      },
      select: {
        id: true,
        activityDate: true,
        subdivision: true,
        ownerName: true,
        title: true,
        executionStatus: true,
      },
      orderBy: [{ activityDate: 'desc' }, { updatedAt: 'desc' }],
      take: 8,
    }).catch(() => []),
    prisma.$queryRaw<DailyCountRow[]>(PrismaSql.sql`
      SELECT TO_CHAR("requestDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM "Ticket"
      WHERE "requestDate" >= ${trendStart} AND "requestDate" < ${trendEnd}
      GROUP BY 1 ORDER BY 1
    `).catch(() => []),
    prisma.$queryRaw<DailyCountRow[]>(PrismaSql.sql`
      SELECT TO_CHAR("installedDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM "Ticket"
      WHERE "installedDate" >= ${trendStart} AND "installedDate" < ${trendEnd}
      GROUP BY 1 ORDER BY 1
    `).catch(() => []),
    prisma.$queryRaw<DailyCountRow[]>(PrismaSql.sql`
      SELECT TO_CHAR("openedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM "TroubleTicket"
      WHERE "openedAt" >= ${trendStart} AND "openedAt" < ${trendEnd}
        AND COALESCE(NULLIF(TRIM("category"), ''), 'TT') = 'TT'
      GROUP BY 1 ORDER BY 1
    `).catch(() => []),
    prisma.$queryRaw<DailyCountRow[]>(PrismaSql.sql`
      SELECT TO_CHAR("publishDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM "ContentCalendar"
      WHERE "publishDate" >= ${trendStart} AND "publishDate" < ${trendEnd} AND "status" = 'PUBLISHED'
      GROUP BY 1 ORDER BY 1
    `).catch(() => []),
    prisma.$queryRaw<Array<{ month: number; count: number }>>(PrismaSql.sql`
      SELECT
        EXTRACT(MONTH FROM ("installedDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'))::int AS month,
        COUNT(*)::int AS count
      FROM "Ticket"
      WHERE "installedDate" >= ${yearStart} AND "installedDate" < ${yearEnd}
      GROUP BY 1 ORDER BY 1
    `).catch(() => []),
    prisma.$queryRaw<Array<{ month: number; count: number }>>(PrismaSql.sql`
      SELECT
        EXTRACT(MONTH FROM ("closedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'))::int AS month,
        COUNT(*)::int AS count
      FROM "TroubleTicket"
      WHERE "closedAt" >= ${yearStart} AND "closedAt" < ${yearEnd}
      GROUP BY 1 ORDER BY 1
    `).catch(() => []),
    prisma.$queryRaw<Array<{ category: string; month: number; count: number }>>(PrismaSql.sql`
      SELECT
        COALESCE(NULLIF(TRIM(UPPER("problemCategory")), ''), 'UNKNOWN') AS category,
        EXTRACT(MONTH FROM ("openedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'))::int AS month,
        COUNT(*)::int AS count
      FROM "TroubleTicket"
      WHERE "openedAt" >= ${yearStart} AND "openedAt" < ${yearEnd}
        AND COALESCE(NULLIF(TRIM("category"), ''), 'TT') = 'TT'
      GROUP BY 1, 2 ORDER BY 1, 2
    `).catch(() => []),
    prisma.$queryRaw<Array<{ name: string; month: number; count: number }>>(PrismaSql.sql`
      SELECT
        COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown') AS name,
        EXTRACT(MONTH FROM ("installedDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'))::int AS month,
        COUNT(*)::int AS count
      FROM "Ticket"
      WHERE "installedDate" >= ${yearStart} AND "installedDate" < ${yearEnd}
      GROUP BY 1, 2
    `).catch(() => []),
  ])
    : null

  const psbRequested = managerDashboardData?.[0] ?? 0
  const openTroubleTickets = managerDashboardData?.[1] ?? 0
  const serviceTicketStatusRows: ServiceTicketStatusRow[] = managerDashboardData?.[2] ?? []
  const contentPublished = managerDashboardData?.[3] ?? 0
  const contentScheduled = managerDashboardData?.[4] ?? 0
  const digitalLeads = managerDashboardData?.[5] ?? 0
  const serviceSubdivisionRows: ServiceSubdivisionRow[] = managerDashboardData?.[6] ?? []
  const recentServiceActivities: RecentServiceActivityRow[] = managerDashboardData?.[7] ?? []
  const trendSalesRows: DailyCountRow[] = managerDashboardData?.[8] ?? []
  const trendPsbRows: DailyCountRow[] = managerDashboardData?.[9] ?? []
  const trendTroubleRows: DailyCountRow[] = managerDashboardData?.[10] ?? []
  const trendContentRows: DailyCountRow[] = managerDashboardData?.[11] ?? []
  const yearlyPsbRows: Array<{ month: number; count: number }> = managerDashboardData?.[12] ?? []
  const yearlyTroubleClosedRows: Array<{ month: number; count: number }> = managerDashboardData?.[13] ?? []
  const yearlyTroubleCategoryRows: Array<{ category: string; month: number; count: number }> = managerDashboardData?.[14] ?? []
  const yearlyCustomersByMarketingRows: Array<{ name: string; month: number; count: number }> = managerDashboardData?.[15] ?? []

  const isolirByMarketing = new Map<string, number>()
  for (const row of isolirMarketingRows) {
    const name = toDashboardMarketingLabel(row.name, marketingNameMap)
    const key = marketingNameKey(name)
    isolirByMarketing.set(key, (isolirByMarketing.get(key) || 0) + Number(row.count || 0))
  }
  const marketingPerformanceMap = new Map<string, {
    name: string
    count: number
    open: number
    on_progress: number
    close: number
  }>()
  for (const row of marketingRows) {
    const name = toDashboardMarketingLabel(row.name, marketingNameMap)
    const key = marketingNameKey(name)
    const current = marketingPerformanceMap.get(key) ?? { name, count: 0, open: 0, on_progress: 0, close: 0 }
    current.count += Number(row.count || 0)
    current.open += Number(row.open || 0)
    current.on_progress += Number(row.on_progress || 0)
    current.close += Number(row.close || 0)
    marketingPerformanceMap.set(key, current)
  }
  const marketingPerformance = Array.from(marketingPerformanceMap.values())
    .map((row) => ({ ...row, isolir: isolirByMarketing.get(marketingNameKey(row.name)) || 0 }))
    .sort((a, b) => b.close - a.close || a.name.localeCompare(b.name))

  const availability = await getSocialAvailability(periodStart, periodEnd).catch(() => ({
    availabilityPercent: 0,
    totalChecks: 0,
    successfulChecks: 0,
    avgLatencyMs: null as number | null,
    downtimeMinutes: 0,
    lastCheckedAt: null as Date | null,
    byPlatform: [] as Array<{ platform: string; label: string; availabilityPercent: number; totalChecks: number; successfulChecks: number; lastSuccessAt: Date | null; lastFailureAt: Date | null; currentStatus: 'UP' | 'DOWN' | 'UNKNOWN' }>,
  }))

  const latest = snapshotPeriodRows[snapshotPeriodRows.length - 1]
  const lySnapshot = snapshotComparisonRows[0]
  const snapshotAvailable = Boolean(latest)

  const totalCustomers = latest?.totalCustomers ?? 0
  const activeCustomers = latest?.activeCustomers ?? 0
  const declinePercent = latest?.customerDeclinePercent ?? 0
  const lyTotalCustomers = lySnapshot?.totalCustomers ?? 0
  const lyActiveCustomers = lySnapshot?.activeCustomers ?? 0

  const customerGrowth = latest && lyTotalCustomers > 0 ? ((totalCustomers - lyTotalCustomers) / lyTotalCustomers) * 100 : 0
  const activeGrowth = latest && lyActiveCustomers > 0 ? ((activeCustomers - lyActiveCustomers) / lyActiveCustomers) * 100 : 0
  const psbGrowth = periodHasStarted && psbInstalledLY > 0
    ? ((psbInstalled - psbInstalledLY) / psbInstalledLY) * 100
    : 0
  const ttCloseRate = pct(ttClosed, ttOpened)
  const mttrHours = Number(avgMttrRows[0]?.avg_hours || 0)
  const isolationCloseRate = pct(isolationRestored, isolationNew)

  const customerTrend = snapshotPeriodRows.map((row) => ({
    month: String(new Date(row.reportDate).getUTCDate()).padStart(2, '0'),
    totalCustomers: Number(row.totalCustomers || 0),
    activeCustomers: Number(row.activeCustomers || 0),
  }))

  const psbDailyRows = await prisma.$queryRaw<Array<{ day: number; count: number }>>(PrismaSql.sql`
    SELECT EXTRACT(DAY FROM ("installedDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'))::int AS day, COUNT(*)::int AS count
    FROM "Ticket"
    WHERE "installedDate" >= ${periodStart} AND "installedDate" < ${periodEnd}
    GROUP BY 1
    ORDER BY 1 ASC
  `).catch(() => [])
  const psbTrend = dayLabels.map((label, index) => ({
    month: label,
    installed: Number(psbDailyRows.find((row) => row.day === index + 1)?.count ?? 0),
  }))

  const trendDates = Array.from({ length: trendDays }, (_, index) => {
    const date = new Date(trendStart.getTime() + index * 24 * 60 * 60 * 1000 + JAKARTA_OFFSET_MS)
    return date.toISOString().slice(0, 10)
  })
  const trendMap = new Map(trendDates.map((date) => [
    date,
    { date, label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`)), sales: 0, psb: 0, trouble: 0, content: 0 },
  ]))
  const addTrendRows = (rows: Array<{ date: string; count: number }>, key: 'sales' | 'psb' | 'trouble' | 'content') => {
    for (const row of rows) {
      const point = trendMap.get(String(row.date))
      if (point) point[key] += Number(row.count || 0)
    }
  }
  addTrendRows(trendSalesRows, 'sales')
  addTrendRows(trendPsbRows, 'psb')
  addTrendRows(trendTroubleRows, 'trouble')
  addTrendRows(trendContentRows, 'content')
  const activityTrend = Array.from(trendMap.values())

  // Trouble ticket trend by category for each day in the selected month.
  const troubleByCategory = new Map<string, number[]>()
  for (const row of troubleDailyRows) {
    const cat = String(row.problemCategory || 'UNKNOWN')
    const arr = troubleByCategory.get(cat) ?? Array.from({ length: daysInPeriod }, () => 0)
    const idx = Math.max(0, Math.min(daysInPeriod - 1, Number(row.day) - 1))
    arr[idx] = (arr[idx] || 0) + Number(row.count || 0)
    troubleByCategory.set(cat, arr)
  }
  const topCategories = Array.from(troubleByCategory.entries())
    .map(([name, byMonth]) => ({ name, total: byMonth.reduce((a, b) => a + b, 0), byMonth }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
  const troubleTrend = { months: dayLabels, rows: topCategories }

  // Package distribution
  const packageDistribution = packageRows
    .map((r) => ({ name: r.name || 'Unknown', count: Number(r.count || 0) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // Network stats
  const odpStats = odpStatsRows[0]
  const odpTotal = Number(odpStats?.total || 0)
  const portCapacity = Number(odpStats?.kapasitas || 0)
  const portUsed = Number(odpStats?.terpakai || 0)
  const portUtilization = pct(portUsed, portCapacity)

  // ODP map points
  const odpMapRows = await prisma.$queryRaw<Array<{ id: number; nama_odp: string; wilayah: string; kapasitas: number; terpakai: number; latitude: number | null; longitude: number | null }>>(PrismaSql.sql`
    SELECT id, nama_odp, wilayah, kapasitas, terpakai, latitude, longitude
    FROM psb_odp
    WHERE is_active = TRUE AND latitude IS NOT NULL AND longitude IS NOT NULL
  `).catch(() => [])
  const odpMapPoints = odpMapRows
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      id: r.id,
      name: r.nama_odp,
      wilayah: r.wilayah,
      kapasitas: Number(r.kapasitas || 0),
      terpakai: Number(r.terpakai || 0),
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
    }))

  const averagePresentPerDay = Number(attendancePeriodRows[0]?.average_present || 0)
  const attendanceDays = Number(attendancePeriodRows[0]?.attendance_days || 0)
  const averageAbsentPerDay = Math.max(0, activeEmployees - averagePresentPerDay)

  // Ringkasan kinerja per divisi organisasi (mengikuti departemen HR).
  const memberMap = new Map(
    employeeDivisionRows.map((r) => [String(r.department || '').trim(), Number(r.count || 0)])
  )
  const dailyMap = new Map(
    dailyActivityRows.map((r) => [
      String(r.division || '').trim(),
      { total: Number(r.total || 0), done: Number(r.done || 0) },
    ])
  )
  const dailyProgress = (name: string) => {
    const da = dailyMap.get(name)
    if (!da || da.total === 0) return 0
    return Math.round((da.done / da.total) * 100)
  }

  const divisions: DivisionRow[] = [
    {
      code: 'Pemasaran dan Pelayanan',
      label: 'Pemasaran dan Pelayanan',
      primaryValue: psbInstalled,
      primaryLabel: 'PSB terpasang',
      secondaryValue: isolationNew,
      secondaryLabel: 'Isolir baru',
      progress: dailyProgress('Pemasaran dan Pelayanan'),
      members: memberMap.get('Pemasaran dan Pelayanan') || 0,
    },
    {
      code: 'Teknisi',
      label: 'Teknisi',
      primaryValue: ttClosed,
      primaryLabel: 'TT diselesaikan',
      secondaryValue: mttrHours,
      secondaryLabel: 'MTTR (jam)',
      progress: dailyProgress('Teknisi'),
      members: memberMap.get('Teknisi') || 0,
    },
    {
      code: 'General Affair',
      label: 'General Affair',
      primaryValue: dailyMap.get('General Affair')?.total ?? 0,
      primaryLabel: 'Aktivitas harian',
      secondaryValue: memberMap.get('General Affair') || 0,
      secondaryLabel: 'Anggota saat ini',
      progress: dailyProgress('General Affair'),
      members: memberMap.get('General Affair') || 0,
    },
    {
      code: 'Finance & HR',
      label: 'Finance & HR',
      primaryValue: activeEmployees,
      primaryLabel: 'Karyawan aktif saat ini',
      secondaryValue: averagePresentPerDay,
      secondaryLabel: 'Rata-rata hadir/hari',
      progress: activeEmployees > 0 ? Math.min(100, Math.round((averagePresentPerDay / activeEmployees) * 100)) : 0,
      members: memberMap.get('Finance & HR') || 0,
    },
    {
      code: 'Operasional',
      label: 'Operasional',
      primaryValue: availability.availabilityPercent,
      primaryLabel: 'Availability jaringan',
      valueSuffix: '%',
      secondaryValue: portUtilization,
      secondaryLabel: 'Utilisasi port saat ini',
      secondarySuffix: '%',
      progress: availability.availabilityPercent,
      members: memberMap.get('Operasional') || 0,
    },
  ]

  const ticketStatusCounts = new Map(
    serviceTicketStatusRows.map((row) => [String(row.status).trim().toUpperCase(), Number(row.count || 0)])
  )
  const subdivisionPerformance = serviceSubdivisionRows.map((row) => {
    const total = Number(row.total || 0)
    const done = Number(row.done || 0)
    return {
      subdivision: String(row.subdivision || 'Tanpa Subdivisi'),
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    }
  })
  const recentActivities = recentServiceActivities.map((row) => ({
    id: row.id,
    date: row.activityDate,
    subdivision: row.subdivision || 'Pemasaran dan Pelayanan',
    owner: row.ownerName,
    title: row.title,
    status: row.executionStatus,
  }))

  // Tren tahunan PSB (berdasarkan tanggal pasang) per bulan.
  // Hanya tampilkan bulan sampai bulan berjalan (jika tahun terpilih = tahun sekarang).
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const maxVisibleMonth = year < currentYear ? 12 : Math.min(currentMonth, 12)

  const yearlyPsbTrend = yearMonthLabels
    .map((label, index) => {
      const month = index + 1
      const row = yearlyPsbRows.find((r) => Number(r.month) === month)
      return { month, label, count: Number(row?.count || 0) }
    })
    .filter((r) => r.month <= maxVisibleMonth)
  const yearlyPsbTotal = yearlyPsbTrend.reduce((sum, r) => sum + r.count, 0)

  // Tren tahunan Trouble Ticket yang ditutup per bulan.
  const yearlyTroubleClosedTrend = yearMonthLabels
    .map((label, index) => {
      const month = index + 1
      const row = yearlyTroubleClosedRows.find((r) => Number(r.month) === month)
      return { month, label, count: Number(row?.count || 0) }
    })
    .filter((r) => r.month <= maxVisibleMonth)
  const yearlyTroubleClosedTotal = yearlyTroubleClosedTrend.reduce((sum, r) => sum + r.count, 0)

  // Gangguan Trouble Ticket berdasarkan kategori, dipecah per bulan.
  const troubleCategoryMap = new Map<string, number[]>()
  for (const row of yearlyTroubleCategoryRows) {
    const cat = String(row.category || 'UNKNOWN')
    const arr = troubleCategoryMap.get(cat) ?? Array.from({ length: 12 }, () => 0)
    const idx = Math.max(0, Math.min(11, Number(row.month) - 1))
    arr[idx] += Number(row.count || 0)
    troubleCategoryMap.set(cat, arr)
  }
  const yearlyTroubleByCategory = Array.from(troubleCategoryMap.entries())
    .map(([name, byMonth]) => ({
      name,
      byMonth,
      total: byMonth.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
  const yearlyTroubleByCategoryMonths = yearMonthLabels

  // Hanya marketing yang masih aktif (muncul di Kinerja Marketing).
  const activeMarketingKeys = new Set(marketingPerformance.map((r) => marketingNameKey(r.name)))

  // Pelanggan (PSB terpasang) per marketing per bulan, top 15.
  const marketingYearlyMap = new Map<string, number[]>()
  for (const row of yearlyCustomersByMarketingRows) {
    const name = toDashboardMarketingLabel(row.name, marketingNameMap)
    if (!activeMarketingKeys.has(marketingNameKey(name))) continue
    const arr = marketingYearlyMap.get(name) ?? Array.from({ length: 12 }, () => 0)
    const idx = Math.max(0, Math.min(11, Number(row.month) - 1))
    arr[idx] += Number(row.count || 0)
    marketingYearlyMap.set(name, arr)
  }
  const yearlyCustomersByMarketing = Array.from(marketingYearlyMap.entries())
    .map(([name, byMonth]) => ({
      name,
      byMonth,
      total: byMonth.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)

  // Risks
  const risks = []
  if (slaBreachRows.length > 0) {
    risks.push({ category: 'Trouble Ticket > SLA (saat ini)', count: slaBreachRows.length, detail: `${slaBreachRows[0]?.ticketCode || ''} - ${slaBreachRows[0]?.customerName || ''}` })
  }
  if (isolirOverdueRows.length > 0) {
    risks.push({ category: 'Isolir > 30 hari (saat ini)', count: isolirOverdueRows.length, detail: `${isolirOverdueRows[0]?.customerName || ''} (${isolirOverdueRows[0]?.marketing || ''})` })
  }
  const dismantleBacklog = Number(dismantleBacklogRows[0]?.count || 0)
  if (dismantleBacklog > 0) {
    risks.push({ category: 'Dismantle backlog (saat ini)', count: dismantleBacklog, detail: `${dismantleBacklog} pelanggan siap dismantle` })
  }
  const lowActivityDivisions = dailyActivityRows.filter((r) => Number(r.total || 0) > 0 && (Number(r.done || 0) / Number(r.total || 0)) < 0.5)
  if (lowActivityDivisions.length > 0) {
    risks.push({ category: `Daily activity < 50% (${periodLabel})`, count: lowActivityDivisions.length, detail: lowActivityDivisions.map((r) => r.division).join(', ') })
  }

  const dailySeries = snapshotPeriodRows.map((r) => ({
    date: new Date(r.reportDate).toISOString().slice(0, 10),
    label: new Date(r.reportDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
    totalCustomers: Number(r.totalCustomers || 0),
    activeCustomers: Number(r.activeCustomers || 0),
    isolationContinued: Number(r.isolationContinued || 0),
    isolationNotContinued: Number(r.isolationNotContinued || 0),
    dismantleOpen: Number(r.dismantleOpen || 0),
    dismantleClosed: Number(r.dismantleClosed || 0),
  }))

  // Executive summary
  const summaryParts = [
    snapshotAvailable
      ? `Total pelanggan ${totalCustomers.toLocaleString('id-ID')} (aktif ${activeCustomers.toLocaleString('id-ID')})`
      : 'Belum ada snapshot pelanggan pada periode ini',
    customerGrowth !== 0 ? `${customerGrowth > 0 ? 'naik' : 'turun'} ${Math.abs(customerGrowth).toFixed(1)}% YoY` : '',
    `PSB terpasang ${psbInstalled} unit (${psbGrowth !== 0 ? `${psbGrowth > 0 ? '+' : ''}${psbGrowth.toFixed(1)}% YoY` : '-'})`,
    `Availability jaringan ${availability.availabilityPercent.toFixed(2)}%`,
    `TT close rate ${ttCloseRate.toFixed(1)}% (MTTR ${mttrHours.toFixed(1)} jam)`,
    `Isolir close rate ${isolationCloseRate.toFixed(1)}%`,
  ].filter(Boolean)
  const execSummary = `Kinerja ${periodLabel}: ${summaryParts.join('; ')}.`

  const responseData = {
    year,
    month,
    periodLabel,
    snapshotAvailable,
    generatedAt: now.toISOString(),
    kpis: {
      totalCustomers,
      activeCustomers,
      customerDeclinePercent: declinePercent,
      psbInstalled,
      psbRequested,
      installationQueue: Number(latest?.installationQueue || 0),
      dismantleOpen: Number(latest?.dismantleOpen || 0),
      dismantleClosed: Number(latest?.dismantleClosed || 0),
      ttOpened,
      ttClosed,
      openTroubleTickets,
      availabilityPercent: availability.availabilityPercent,
      ttCloseRate,
      mttrHours,
      isolationCloseRate,
    },
    serviceMetrics: {
      ticketStatuses: {
        open: ticketStatusCounts.get('OPEN') || 0,
        onProgress: ticketStatusCounts.get('ON_PROGRESS') || ticketStatusCounts.get('ON PROGRESS') || 0,
        close: ticketStatusCounts.get('CLOSE') || 0,
      },
      contentPublished,
      contentScheduled,
      digitalLeads,
    },
    subdivisionPerformance,
    recentActivities,
    activityTrend,
    deltas: {
      customerGrowth,
      activeGrowth,
      psbGrowth,
    },
    divisions,
    marketingPerformance,
    dailySeries,
    customerTrend,
    psbTrend,
    troubleTrend,
    packageDistribution,
    network: {
      odpTotal,
      popCount,
      portCapacity,
      portUsed,
      portUtilization,
      availabilityPercent: availability.availabilityPercent,
      avgLatencyMs: availability.avgLatencyMs,
      downtimeMinutes: availability.downtimeMinutes,
      lastCheckedAt: availability.lastCheckedAt,
      byPlatform: availability.byPlatform,
      odpMapPoints,
    },
    hr: {
      activeEmployees,
      averagePresentPerDay,
      averageAbsentPerDay,
      attendanceDays,
    },
    risks,
    execSummary,
  }

  if (isMarketingServiceManager(session.user.role, session.user.position, session.user.division)) {
    const managerRisks = [
      {
        category: 'PSB belum terpasang',
        count: Math.max(0, psbRequested - psbInstalled),
        detail: 'Permohonan PSB dikurangi pemasangan pada periode ini',
      },
      {
        category: 'Tiket pelanggan belum selesai',
        count: (ticketStatusCounts.get('OPEN') || 0) +
          (ticketStatusCounts.get('ON_PROGRESS') || ticketStatusCounts.get('ON PROGRESS') || 0),
        detail: 'Tiket PSB berstatus open atau dalam proses',
      },
      {
        category: 'Gangguan masih aktif',
        count: openTroubleTickets,
        detail: 'Trouble ticket yang belum ditutup',
      },
      {
        category: 'Konten belum tayang',
        count: contentScheduled,
        detail: 'Konten terjadwal pada periode ini',
      },
    ].filter((item) => item.count > 0)

    return NextResponse.json({
      year,
      month,
      periodLabel,
      generatedAt: now.toISOString(),
      kpis: {
        psbInstalled,
        psbRequested,
        installationQueue: Number(latest?.installationQueue || 0),
        dismantleOpen: Number(latest?.dismantleOpen || 0),
        ttOpened,
        ttClosed,
        openTroubleTickets,
        availabilityPercent: availability.availabilityPercent,
        ttCloseRate,
      },
      serviceMetrics: {
        ticketStatuses: {
          open: ticketStatusCounts.get('OPEN') || 0,
          onProgress: ticketStatusCounts.get('ON_PROGRESS') || ticketStatusCounts.get('ON PROGRESS') || 0,
          close: ticketStatusCounts.get('CLOSE') || 0,
        },
        contentPublished,
        contentScheduled,
        digitalLeads,
      },
      subdivisionPerformance,
      recentActivities,
      activityTrend,
      marketingPerformance,
      yearlyPsbTrend,
      yearlyPsbTotal,
      yearlyTroubleClosedTrend,
      yearlyTroubleClosedTotal,
      yearlyTroubleByCategory,
      yearlyTroubleByCategoryMonths,
      yearlyCustomersByMarketing,
      yearlyCustomersByMarketingMonths: yearMonthLabels,
      risks: managerRisks,
      execSummary: `Periode ${periodLabel}: ${psbInstalled} PSB terpasang dari ${psbRequested} permohonan; ${ttClosed} gangguan diselesaikan; availability jaringan ${availability.availabilityPercent.toFixed(1)}%; ${contentPublished} konten tayang dan ${digitalLeads} leads digital.`,
    })
  }

  return NextResponse.json(responseData)
}
