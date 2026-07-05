import { DashboardView } from '@/components/DashboardView'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Prisma as PrismaSql } from '@prisma/client'
import { ensureDbOptimizations, ensureUserDivisionColumn } from '@/lib/db-init'
import { cache } from '@/lib/cache'
import { jakartaMonthRange, jakartaNow, JAKARTA_OFFSET_MS } from '@/lib/jakarta-time'
import { ensureOdpTable } from '@/lib/odp-init'
import { ensureDismantleHistoryTable } from '@/lib/dismantle-history'
import { getMarketingNameMap, marketingNameKey, normalizeMarketingName, toDashboardMarketingLabel } from '@/lib/marketing-users'

export const dynamic = 'force-dynamic'

type DivisionSummary = {
  code: 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'
  label: string
  description: string
  members: number
  primaryValue: number
  primaryLabel: string
  secondaryValue: number
  secondaryLabel: string
  extraStats?: Array<{ label: string; value: number }>
  note?: string
}

type DivisionFilter = DivisionSummary['code'] | 'ALL'

type DashboardPayload = {
  packageData: { name: string; count: number }[]
  marketingDataWithIsolir: { name: string; count: number; open: number; on_progress: number; close: number; isolir?: number }[]
  monthlyData: { name: string; count: number }[]
  yearTopPackages: { name: string; count: number }[]
  yearMarketingMonthly: {
    months: string[]
    rows: Array<{ name: string; total: number; byMonth: number[] }>
  }
  statusCounts: { total: number; open: number; close: number; on_progress: number }
  isolationCount: number
  marketingActivityTotal: number
  odpTotal: number
  ticketingTotal: number
  ticketingMonthRecap: Array<{ type: string; total: number; open: number; close: number }>
  troubleTicketProblemMonthly: {
    months: string[]
    rows: Array<{ problemCategory: string; total: number; byMonth: number[] }>
  }
  divisionSummary: DivisionSummary[]
}

function aggregateMarketingRows<T extends { name: string }>(
  rows: T[],
  nameMap: Map<string, string>
) {
  const aggregated = new Map<string, T>()
  for (const row of rows) {
    const label = toDashboardMarketingLabel(row.name, nameMap)
    const existing = aggregated.get(label)
    if (existing) {
      for (const [key, value] of Object.entries(row)) {
        if (key === 'name') continue
        if (typeof value === 'number') {
          ;(existing as Record<string, unknown>)[key] = Number((existing as Record<string, unknown>)[key] || 0) + value
        }
      }
      continue
    }
    aggregated.set(label, { ...row, name: label })
  }

  return Array.from(aggregated.values())
}

function createEmptyDashboardPayload(): DashboardPayload {
  return {
    packageData: [],
    marketingDataWithIsolir: [],
    monthlyData: [],
    yearTopPackages: [],
    yearMarketingMonthly: { months: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'], rows: [] },
    statusCounts: { total: 0, open: 0, close: 0, on_progress: 0 },
    isolationCount: 0,
    marketingActivityTotal: 0,
    odpTotal: 0,
    ticketingTotal: 0,
    ticketingMonthRecap: [],
    troubleTicketProblemMonthly: { months: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'], rows: [] },
    divisionSummary: [
      {
        code: 'PENJUALAN',
        label: 'Penjualan',
        description: 'Fokus pada performa PSB dan aktivitas marketing',
        members: 0,
        primaryValue: 0,
        primaryLabel: 'PSB periode ini',
        secondaryValue: 0,
        secondaryLabel: 'Aktivitas marketing',
      },
      {
        code: 'CS_ADMIN',
        label: 'CS',
        description: 'Fokus pada isolir aktif dan tindak lanjut layanan pelanggan',
        members: 0,
        primaryValue: 0,
        primaryLabel: 'Isolir aktif',
        secondaryValue: 0,
        secondaryLabel: 'Riwayat isolir',
      },
      {
        code: 'NOC_TROUBLESHOOTS',
        label: 'NOC',
        description: 'Fokus pada penanganan dan penyelesaian gangguan',
        members: 0,
        primaryValue: 0,
        primaryLabel: 'Ticket close',
        secondaryValue: 0,
        secondaryLabel: 'Ticket open',
      },
      {
        code: 'CREATOR_DIGITAL',
        label: 'Creator Digital',
        description: 'Konten, campaign, leads, dan analytics untuk pengembangan digital',
        members: 0,
        primaryValue: 0,
        primaryLabel: 'Digital leads',
        secondaryValue: 0,
        secondaryLabel: 'Konten tercatat',
      },
    ],
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  await ensureDbOptimizations()

  const resolvedSearchParams = await searchParams
  const monthParam = resolvedSearchParams.month
  const yearParam = resolvedSearchParams.year
  const divisionParam = resolvedSearchParams.division

  const now = jakartaNow()
  const currentMonth = typeof monthParam === 'string' ? parseInt(monthParam) : now.getMonth() + 1
  const currentYear = typeof yearParam === 'string' ? parseInt(yearParam) : now.getFullYear()
  const selectedDivision: DivisionFilter =
    typeof divisionParam === 'string' &&
    ['PENJUALAN', 'CS_ADMIN', 'NOC_TROUBLESHOOTS', 'CREATOR_DIGITAL'].includes(divisionParam)
      ? (divisionParam as DivisionSummary['code'])
      : 'ALL'

  const cacheKey = `dashboard:${JSON.stringify({
    role: session.user.role,
    name: session.user.name,
    month: currentMonth,
    year: currentYear,
    division: selectedDivision,
  })}`
  const renderDashboard = (payload: DashboardPayload, localNotice?: string) => (
    <div className="space-y-4">
      {localNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {localNotice}
        </div>
      )}
      <DashboardView
        packageData={payload.packageData}
        marketingData={payload.marketingDataWithIsolir}
        monthlyData={payload.monthlyData}
        yearTopPackages={payload.yearTopPackages}
        yearMarketingMonthly={payload.yearMarketingMonthly}
        statusCounts={payload.statusCounts}
        ticketingMonthRecap={payload.ticketingMonthRecap}
        troubleTicketProblemMonthly={payload.troubleTicketProblemMonthly}
        initialPeriod={{ month: currentMonth, year: currentYear }}
        userRole={session.user.role}
        divisionSummary={payload.divisionSummary}
        selectedDivision={selectedDivision}
      />
    </div>
  )

  const cached = cache.get<DashboardPayload>(cacheKey)
  if (cached) {
    return renderDashboard(cached)
  }

  try {
    await ensureUserDivisionColumn().catch(() => {})
    const { start: startDate, end: endDate } = jakartaMonthRange(currentYear, currentMonth)
    const isSelectedCurrentMonth = (() => {
      const n = jakartaNow()
      return n.getFullYear() === currentYear && (n.getMonth() + 1) === currentMonth
    })()
    const openStatuses = ['OPEN', 'ON_PROGRESS']

    const marketingRole = session.user.role === 'MARKETING'
    const marketingName = session.user.name || ''
    const marketingNameFilter = normalizeMarketingName(marketingName)
    const marketingNameMap = await getMarketingNameMap()

    const statusVals = PrismaSql.join(openStatuses.map((s) => PrismaSql.sql`${s}`))
    const marketingClause = marketingRole
      ? PrismaSql.sql`AND LOWER(TRIM("marketingName")) = ${marketingNameFilter.toLowerCase()}`
      : PrismaSql.sql``
    const carryClause = isSelectedCurrentMonth
      ? PrismaSql.sql`OR ("installedDate" IS NULL AND "status" IN (${statusVals}) AND "requestDate" < ${endDate})`
      : PrismaSql.sql``

    const [statusRows, packageRows, marketingRows] = await Promise.all([
    prisma.$queryRaw<Array<{ status: string; count: number }>>(PrismaSql.sql`
      SELECT "status" AS status, COUNT(*)::int AS count
      FROM "Ticket"
      WHERE (
        ("installedDate" IS NOT NULL AND "installedDate" >= ${startDate} AND "installedDate" < ${endDate})
        ${carryClause}
      )
      ${marketingClause}
      GROUP BY "status"
    `),
    prisma.$queryRaw<Array<{ name: string; count: number }>>(PrismaSql.sql`
      WITH src AS (
        SELECT CASE
          WHEN UPPER("package") LIKE '%HOME LITE%' THEN 'HOME LITE'
          WHEN UPPER("package") LIKE '%HOME BASIC%' THEN 'HOME BASIC'
          WHEN UPPER("package") LIKE '%HOME STREAM%' THEN 'HOME STREAM'
          WHEN UPPER("package") LIKE '%HOME ENTERTAIN%' THEN 'HOME ENTERTAIN'
          WHEN UPPER("package") LIKE '%HOME SMALL%' THEN 'HOME SMALL'
          WHEN UPPER("package") LIKE '%HOME ADVAN%' THEN 'HOME ADVAN'
          ELSE COALESCE("package",'Unknown')
        END AS name
        FROM "Ticket"
        WHERE (
          ("installedDate" IS NOT NULL AND "installedDate" >= ${startDate} AND "installedDate" < ${endDate})
          ${carryClause}
        )
        ${marketingClause}
      )
      SELECT name, COUNT(*)::int AS count
      FROM src
      GROUP BY name
      ORDER BY COUNT(*) DESC
    `),
    prisma.$queryRaw<Array<{ name: string; count: number; open: number; on_progress: number; close: number }>>(PrismaSql.sql`
      SELECT
        COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown') AS name,
        COUNT(*)::int AS count,
        SUM(CASE WHEN "status" = 'OPEN' THEN 1 ELSE 0 END)::int AS open,
        SUM(CASE WHEN "status" IN ('ON_PROGRESS','PENDING') THEN 1 ELSE 0 END)::int AS on_progress,
        SUM(CASE WHEN "status" = 'CLOSE' THEN 1 ELSE 0 END)::int AS close
      FROM "Ticket"
      WHERE (
        ("installedDate" IS NOT NULL AND "installedDate" >= ${startDate} AND "installedDate" < ${endDate})
        ${carryClause}
      )
      ${marketingClause}
      GROUP BY COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown')
      ORDER BY SUM(CASE WHEN "status" = 'CLOSE' THEN 1 ELSE 0 END) DESC
    `),
  ])

    const packageOrder = ['HOME LITE', 'HOME BASIC', 'HOME STREAM', 'HOME ENTERTAIN', 'HOME SMALL', 'HOME ADVAN']
    const packageData = packageRows
    .map((r) => ({ name: r.name || 'Unknown', count: Number(r.count || 0) }))
    .sort((a, b) => {
      const indexA = packageOrder.indexOf(a.name)
      const indexB = packageOrder.indexOf(b.name)
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    const marketingData = aggregateMarketingRows(
      marketingRows.map((r) => ({
        name: String(r.name || ''),
        count: Number(r.count || 0),
        open: Number(r.open || 0),
        on_progress: Number(r.on_progress || 0),
        close: Number(r.close || 0),
      })),
      marketingNameMap
    ).sort((a, b) => b.close - a.close || b.count - a.count || a.name.localeCompare(b.name))

  // 2b. Monthly recap untuk tahun terpilih (Jan..Dec) – hanya berdasarkan installedDate (pemasangan selesai)
    const yearStart = new Date(Date.UTC(currentYear, 0, 1) - JAKARTA_OFFSET_MS)
    const yearEnd = new Date(Date.UTC(currentYear + 1, 0, 1) - JAKARTA_OFFSET_MS)
  // Gunakan date_trunc di Postgres pada installedDate saja agar selaras dengan List PSB
    const monthlyRows = await prisma.$queryRaw<Array<{ month: number; count: number }>>`
    SELECT
      EXTRACT(MONTH FROM date_trunc('month', "installedDate"))::int AS month,
      COUNT(*)::int AS count
    FROM "Ticket"
    WHERE "installedDate" IS NOT NULL
      AND "installedDate" >= ${yearStart}
      AND "installedDate" < ${yearEnd}
    GROUP BY 1
    ORDER BY 1
  `
    const monthlyBuckets: number[] = Array.from({ length: 12 }, () => 0)
    for (const row of monthlyRows) {
      const idx = Math.max(1, Math.min(12, row.month)) - 1
      monthlyBuckets[idx] = row.count || 0
    }
    const monthLabels = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
    const monthlyData = monthLabels.map((label, idx) => ({
      name: label,
      count: monthlyBuckets[idx] || 0
    }))

  // 2c. Top packages of the year (untuk kebijakan)
    const yearTopPackagesRows = await prisma.$queryRaw<Array<{ name: string; count: number }>>`
    WITH src AS (
      SELECT CASE
        WHEN UPPER("package") LIKE '%HOME LITE%' THEN 'HOME LITE'
        WHEN UPPER("package") LIKE '%HOME BASIC%' THEN 'HOME BASIC'
        WHEN UPPER("package") LIKE '%HOME STREAM%' THEN 'HOME STREAM'
        WHEN UPPER("package") LIKE '%HOME ENTERTAIN%' THEN 'HOME ENTERTAIN'
        WHEN UPPER("package") LIKE '%HOME SMALL%' THEN 'HOME SMALL'
        WHEN UPPER("package") LIKE '%HOME ADVAN%' THEN 'HOME ADVAN'
        ELSE COALESCE("package",'Unknown')
      END AS name
      FROM "Ticket"
      WHERE "installedDate" >= ${yearStart}
        AND "installedDate" < ${yearEnd}
    )
    SELECT name, COUNT(*)::int AS count
    FROM src
    GROUP BY name
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `
    const yearTopPackages = yearTopPackagesRows.map(r => ({ name: r.name || 'Unknown', count: Number(r.count || 0) }))

    const yearMarketingMonthlyRows = await prisma
    .$queryRaw<Array<{ month: number; name: string; count: number }>>(PrismaSql.sql`
      WITH raw AS (
        SELECT
          EXTRACT(MONTH FROM date_trunc('month', "installedDate"))::int AS month,
          COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown') AS raw_name
        FROM "Ticket"
        WHERE "installedDate" >= ${yearStart}
          AND "installedDate" < ${yearEnd}
      ),
      norm AS (
        SELECT
          month,
          CASE
            WHEN raw_name ILIKE 'marketing %' THEN TRIM(SUBSTRING(raw_name FROM 11))
            WHEN raw_name ILIKE 'marketing:%' THEN TRIM(SUBSTRING(raw_name FROM 12))
            WHEN raw_name ILIKE 'marketing-%' THEN TRIM(SUBSTRING(raw_name FROM 12))
            ELSE raw_name
          END AS name
        FROM raw
      ),
      agg AS (
        SELECT
          month,
          COALESCE(NULLIF(name, ''), 'Unknown') AS name,
          COUNT(*)::int AS count
        FROM norm
        GROUP BY 1, 2
      ),
      topn AS (
        SELECT name, SUM(count)::int AS total
        FROM agg
        GROUP BY 1
        ORDER BY SUM(count) DESC, name ASC
        LIMIT 15
      )
      SELECT agg.month, agg.name, agg.count
      FROM agg
      JOIN topn ON topn.name = agg.name
      ORDER BY topn.total DESC, agg.name ASC, agg.month ASC
    `)
    .catch(() => [])

    const yearMarketingMonthly = (() => {
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
    const byName = new Map<string, { total: number; byMonth: number[] }>()
    for (const row of yearMarketingMonthlyRows) {
      const month = Math.max(1, Math.min(12, Number(row.month || 0)))
      const idx = month - 1
      const name = toDashboardMarketingLabel(row.name, marketingNameMap)
      const count = Number(row.count || 0)
      const existing = byName.get(name) ?? { total: 0, byMonth: Array.from({ length: 12 }, () => 0) }
      existing.byMonth[idx] = (existing.byMonth[idx] || 0) + count
      existing.total += count
      byName.set(name, existing)
    }

    const rows = Array.from(byName.entries())
      .map(([name, v]) => ({ name, total: v.total, byMonth: v.byMonth }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

    return { months, rows }
  })()

    const onProgressCount = (statusRows.find((r) => r.status === 'ON_PROGRESS')?.count || 0) + (statusRows.find((r) => r.status === 'PENDING')?.count || 0)
    const statusCounts = {
    total: statusRows.reduce((acc, r) => acc + Number(r.count || 0), 0),
    open: statusRows.find((r) => r.status === 'OPEN')?.count || 0,
    close: statusRows.find((r) => r.status === 'CLOSE')?.count || 0,
    on_progress: onProgressCount,
  }

    const isoRoleClause = marketingRole
      ? PrismaSql.sql`AND LOWER(TRIM("marketing")) = ${marketingNameFilter.toLowerCase()}`
      : PrismaSql.sql``
    const isoRows = await prisma.$queryRaw<Array<{ name: string; count: number }>>(PrismaSql.sql`
    SELECT COALESCE(NULLIF(TRIM("marketing"), ''), 'Unknown') AS name, COUNT(*)::int AS count
    FROM "Isolation"
    WHERE "status" = 'OPEN'
    ${isoRoleClause}
    GROUP BY COALESCE(NULLIF(TRIM("marketing"), ''), 'Unknown')
  `)
    const isolirByMarketing = new Map<string, number>()
    for (const row of isoRows) {
      const label = toDashboardMarketingLabel(row.name, marketingNameMap)
      const key = marketingNameKey(label)
      isolirByMarketing.set(key, (isolirByMarketing.get(key) || 0) + Number(row.count || 0))
    }
    const isolationCount = isoRows.reduce((acc, r) => acc + Number(r.count || 0), 0)

    const [marketingActivityTotal, odpTotal, ticketingTotal, isolationClosedCount, creatorContentCount, creatorCampaignCount, creatorLeadCount, dismantleOpenCount, dismantleHistoryCount] = await Promise.all([
    prisma.marketingActivity.count({
      where: {
        ...(marketingRole
          ? {
              marketingName: {
                equals: marketingNameFilter,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        date: { gte: startDate, lt: endDate },
      },
    }).catch(() => 0),
    (async () => {
      try {
        await ensureOdpTable()
        const rows = await prisma.$queryRaw<Array<{ count: number }>>(PrismaSql.sql`
          SELECT COUNT(*)::int AS count
          FROM psb_odp
          WHERE is_active = TRUE
        `)
        return Number(rows[0]?.count || 0)
      } catch {
        return 0
      }
    })(),
    prisma
      .$queryRaw<Array<{ count: number }>>(PrismaSql.sql`
        SELECT COUNT(*)::int AS count
        FROM "TroubleTicket"
        WHERE "periodMonth" = ${currentMonth}
          AND "periodYear" = ${currentYear}
      `)
      .then((rows) => Number(rows[0]?.count || 0))
      .catch(() => 0),
    prisma.isolation.count({ where: { status: 'CLOSED' } }).catch(() => 0),
    (prisma as any).contentCalendar?.count().catch(() => 0),
    (prisma as any).campaign?.count().catch(() => 0),
    (prisma as any).digitalLead?.count().catch(() => 0),
    (async () => {
      try {
        await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "ticketDismantle" TEXT')
        const rows = await prisma.$queryRaw<Array<{ count: number }>>(PrismaSql.sql`
          SELECT COUNT(*)::int AS count
          FROM "Isolation"
          WHERE "status" = 'OPEN'
            AND COALESCE(TRIM("ticketDismantle"), '') <> ''
        `)
        return Number(rows[0]?.count || 0)
      } catch {
        return 0
      }
    })(),
    (async () => {
      try {
        await ensureDismantleHistoryTable()
        const rows = await prisma.$queryRaw<Array<{ count: number }>>(PrismaSql.sql`
          SELECT COUNT(*)::int AS count
          FROM "DismantleHistory"
        `)
        return Number(rows[0]?.count || 0)
      } catch {
        return 0
      }
    })(),
  ])
    const dismantleTotal = dismantleOpenCount + dismantleHistoryCount

    const ticketingMonthRecap = await prisma
    .$queryRaw<Array<{ type: string; total: number; open: number; close: number }>>(PrismaSql.sql`
      SELECT
        COALESCE(NULLIF(TRIM(UPPER("type")), ''), 'UNKNOWN') AS type,
        COUNT(*)::int AS total,
        SUM(CASE WHEN "status" = 'OPEN' THEN 1 ELSE 0 END)::int AS open,
        SUM(CASE WHEN "status" = 'CLOSE' THEN 1 ELSE 0 END)::int AS close
      FROM "TroubleTicket"
      WHERE "periodMonth" = ${currentMonth}
        AND "periodYear" = ${currentYear}
      GROUP BY 1
      ORDER BY COUNT(*) DESC, type ASC
    `)
    .catch(() => [])

    const troubleTicketProblemMonthlyRows = await prisma
    .$queryRaw<Array<{ month: number; problemCategory: string; count: number }>>(PrismaSql.sql`
      SELECT
        EXTRACT(MONTH FROM date_trunc('month', "openedAt"))::int AS month,
        COALESCE(NULLIF(TRIM(UPPER("problemCategory")), ''), 'UNKNOWN') AS "problemCategory",
        COUNT(*)::int AS count
      FROM "TroubleTicket"
      WHERE "openedAt" >= ${yearStart}
        AND "openedAt" < ${yearEnd}
        AND COALESCE(NULLIF(TRIM("category"), ''), 'TT') = 'TT'
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `)
    .catch(() => [])

    const troubleTicketProblemMonthly = (() => {
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
    const byCategory = new Map<string, { total: number; byMonth: number[] }>()
    for (const row of troubleTicketProblemMonthlyRows) {
      const month = Math.max(1, Math.min(12, Number(row.month || 0)))
      const idx = month - 1
      const key = String(row.problemCategory || 'UNKNOWN').trim() || 'UNKNOWN'
      const count = Number(row.count || 0)
      const existing = byCategory.get(key) ?? { total: 0, byMonth: Array.from({ length: 12 }, () => 0) }
      existing.byMonth[idx] = (existing.byMonth[idx] || 0) + count
      existing.total += count
      byCategory.set(key, existing)
    }

    const rows = Array.from(byCategory.entries())
      .map(([problemCategory, v]) => ({ problemCategory, total: v.total, byMonth: v.byMonth }))
      .sort((a, b) => b.total - a.total || a.problemCategory.localeCompare(b.problemCategory))
      .slice(0, 5)

    return { months, rows }
  })()

  // Merge isolir count into marketingData
    const marketingDataWithIsolir = marketingData.map((m) => ({
      ...m,
      isolir: isolirByMarketing.get(marketingNameKey(m.name)) || 0
    }))

    const divisionCountRows = await prisma
      .$queryRaw<Array<{ division: string; count: number }>>(PrismaSql.sql`
        SELECT COALESCE(NULLIF(TRIM("division"), ''), 'UNASSIGNED') AS division, COUNT(*)::int AS count
        FROM "User"
        GROUP BY 1
      `)
      .catch(() => [])

    const divisionCounts = new Map<string, number>(
      divisionCountRows.map((row) => [String(row.division || 'UNASSIGNED').trim().toUpperCase(), Number(row.count || 0)])
    )
    const ticketOpenTotal = ticketingMonthRecap.reduce((acc, row) => acc + Number(row.open || 0), 0)
    const ticketCloseTotal = ticketingMonthRecap.reduce((acc, row) => acc + Number(row.close || 0), 0)
    const divisionSummary: DivisionSummary[] = [
      {
        code: 'PENJUALAN',
        label: 'Penjualan',
        description: 'Fokus pada performa PSB dan aktivitas marketing',
        members: divisionCounts.get('PENJUALAN') || 0,
        primaryValue: statusCounts.total,
        primaryLabel: 'PSB periode ini',
        secondaryValue: marketingActivityTotal,
        secondaryLabel: 'Aktivitas marketing',
      },
      {
        code: 'CS_ADMIN',
        label: 'CS',
        description: 'Fokus pada isolir aktif dan tindak lanjut layanan pelanggan',
        members: divisionCounts.get('CS_ADMIN') || 0,
        primaryValue: isolationCount,
        primaryLabel: 'Isolir aktif',
        secondaryValue: isolationClosedCount,
        secondaryLabel: 'Riwayat isolir',
        extraStats: [
          { label: 'Port ODP', value: odpTotal },
          { label: 'Isolir', value: isolationCount },
          { label: 'Dismantle', value: dismantleTotal },
        ],
      },
      {
        code: 'NOC_TROUBLESHOOTS',
        label: 'NOC',
        description: 'Fokus pada penanganan dan penyelesaian gangguan',
        members: divisionCounts.get('NOC_TROUBLESHOOTS') || 0,
        primaryValue: ticketCloseTotal,
        primaryLabel: 'Ticket close',
        secondaryValue: ticketOpenTotal,
        secondaryLabel: 'Ticket open',
      },
      {
        code: 'CREATOR_DIGITAL',
        label: 'Creator Digital',
        description: 'Konten, campaign, leads, dan analytics untuk pengembangan digital',
        members: divisionCounts.get('CREATOR_DIGITAL') || 0,
        primaryValue: creatorLeadCount,
        primaryLabel: 'Digital leads',
        secondaryValue: creatorContentCount,
        secondaryLabel: 'Konten tercatat',
      },
    ]

    const payload: DashboardPayload = {
      packageData,
      marketingDataWithIsolir,
      monthlyData,
      yearTopPackages,
      statusCounts,
      isolationCount,
      marketingActivityTotal,
      odpTotal,
      ticketingTotal,
      ticketingMonthRecap,
      yearMarketingMonthly,
      troubleTicketProblemMonthly,
      divisionSummary,
    }

    cache.set(cacheKey, payload, 120_000)
    return renderDashboard(payload)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return renderDashboard(
        createEmptyDashboardPayload(),
        'Mode lokal aktif: dashboard ditampilkan tanpa data karena koneksi database remote sedang tidak tersedia.'
      )
    }
    throw error
  }
}
