import { DashboardView } from '@/components/DashboardView'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Prisma as PrismaSql } from '@prisma/client'
import { ensureDbOptimizations } from '@/lib/db-init'
import { cache } from '@/lib/cache'
import { jakartaMonthRange, jakartaNow, JAKARTA_OFFSET_MS } from '@/lib/jakarta-time'
import { ensureOdpTable } from '@/lib/odp-init'

export const dynamic = 'force-dynamic'

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

  const now = jakartaNow()
  const currentMonth = typeof monthParam === 'string' ? parseInt(monthParam) : now.getMonth() + 1
  const currentYear = typeof yearParam === 'string' ? parseInt(yearParam) : now.getFullYear()

  const cacheKey = `dashboard:${JSON.stringify({
    role: session.user.role,
    name: session.user.name,
    month: currentMonth,
    year: currentYear,
  })}`
  const cached = cache.get<{
    packageData: { name: string; count: number }[]
    marketingDataWithIsolir: { name: string; count: number; open: number; on_progress: number; close: number; isolir?: number }[]
    monthlyData: { name: string; count: number }[]
    yearTopPackages: { name: string; count: number }[]
    yearMarketingCounts: { name: string; count: number }[]
    statusCounts: { total: number; open: number; close: number; on_progress: number }
    isolationCount: number
    marketingActivityTotal: number
    odpTotal: number
    ticketingTotal: number
    ticketingYearRecap: Array<{ type: string; total: number; open: number; close: number }>
  }>(cacheKey)
  if (cached) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
        <DashboardView
          packageData={cached.packageData}
          marketingData={cached.marketingDataWithIsolir}
          monthlyData={cached.monthlyData}
          yearTopPackages={cached.yearTopPackages}
          yearMarketingCounts={cached.yearMarketingCounts}
          statusCounts={cached.statusCounts}
          marketingActivityTotal={cached.marketingActivityTotal}
          odpTotal={cached.odpTotal}
          ticketingTotal={cached.ticketingTotal}
          ticketingYearRecap={cached.ticketingYearRecap}
          initialPeriod={{ month: currentMonth, year: currentYear }}
          userRole={session.user.role}
          isolationCount={cached.isolationCount}
        />
      </div>
    )
  }

  const { start: startDate, end: endDate } = jakartaMonthRange(currentYear, currentMonth)
  const isSelectedCurrentMonth = (() => {
    const n = jakartaNow()
    return n.getFullYear() === currentYear && (n.getMonth() + 1) === currentMonth
  })()
  const openStatuses = ['OPEN', 'ON_PROGRESS']

  const marketingRole = session.user.role === 'MARKETING'
  const marketingName = session.user.name || ''

  const statusVals = PrismaSql.join(openStatuses.map((s) => PrismaSql.sql`${s}`))
  const marketingClause = marketingRole ? PrismaSql.sql`AND "marketingName" = ${marketingName}` : PrismaSql.sql``
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

  const marketingData = marketingRows.map((r) => ({
    name: r.name || 'Unknown',
    count: Number(r.count || 0),
    open: Number(r.open || 0),
    on_progress: Number(r.on_progress || 0),
    close: Number(r.close || 0),
  }))

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

  // 2d. Jumlah pelanggan per marketing per tahun
  const yearMarketingRows = await prisma.$queryRaw<Array<{ name: string; count: number }>>`
    WITH raw AS (
      SELECT COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown') AS raw_name
      FROM "Ticket"
      WHERE "installedDate" >= ${yearStart}
        AND "installedDate" < ${yearEnd}
    ),
    norm AS (
      SELECT
        CASE
          WHEN raw_name ILIKE 'marketing %' THEN TRIM(SUBSTRING(raw_name FROM 11))  -- remove 'marketing ' (10 chars + space)
          WHEN raw_name ILIKE 'marketing:%' THEN TRIM(SUBSTRING(raw_name FROM 12)) -- remove 'marketing:' (10 chars + :)
          WHEN raw_name ILIKE 'marketing-%' THEN TRIM(SUBSTRING(raw_name FROM 12)) -- remove 'marketing-' (10 chars + -)
          ELSE raw_name
        END AS name
      FROM raw
    )
    SELECT COALESCE(NULLIF(name, ''), 'Unknown') AS name, COUNT(*)::int AS count
    FROM norm
    GROUP BY COALESCE(NULLIF(name, ''), 'Unknown')
    ORDER BY COUNT(*) DESC
    LIMIT 15
  `
  const yearMarketingCounts = yearMarketingRows.map(r => ({ name: r.name || 'Unknown', count: Number(r.count || 0) }))

  const onProgressCount = (statusRows.find((r) => r.status === 'ON_PROGRESS')?.count || 0) + (statusRows.find((r) => r.status === 'PENDING')?.count || 0)
  const statusCounts = {
    total: statusRows.reduce((acc, r) => acc + Number(r.count || 0), 0),
    open: statusRows.find((r) => r.status === 'OPEN')?.count || 0,
    close: statusRows.find((r) => r.status === 'CLOSE')?.count || 0,
    on_progress: onProgressCount,
  }

  const isoRoleClause = marketingRole ? PrismaSql.sql`AND "marketing" = ${marketingName}` : PrismaSql.sql``
  const isoRows = await prisma.$queryRaw<Array<{ name: string; count: number }>>(PrismaSql.sql`
    SELECT COALESCE(NULLIF(TRIM("marketing"), ''), 'Unknown') AS name, COUNT(*)::int AS count
    FROM "Isolation"
    WHERE "status" = 'OPEN'
    ${isoRoleClause}
    GROUP BY COALESCE(NULLIF(TRIM("marketing"), ''), 'Unknown')
  `)
  const isolirByMarketing = new Map<string, number>(isoRows.map((r) => [String(r.name || 'Unknown').trim().toLowerCase(), Number(r.count || 0)]))
  const isolationCount = isoRows.reduce((acc, r) => acc + Number(r.count || 0), 0)

  const [marketingActivityTotal, odpTotal, ticketingTotal] = await Promise.all([
    prisma.marketingActivity.count({
      where: {
        ...(marketingRole ? { marketingName } : {}),
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
  ])

  const ticketingYearRecap = await prisma
    .$queryRaw<Array<{ type: string; total: number; open: number; close: number }>>(PrismaSql.sql`
      SELECT
        COALESCE(NULLIF(TRIM(UPPER("type")), ''), 'UNKNOWN') AS type,
        COUNT(*)::int AS total,
        SUM(CASE WHEN "status" = 'OPEN' THEN 1 ELSE 0 END)::int AS open,
        SUM(CASE WHEN "status" = 'CLOSE' THEN 1 ELSE 0 END)::int AS close
      FROM "TroubleTicket"
      WHERE "openedAt" >= ${yearStart}
        AND "openedAt" < ${yearEnd}
      GROUP BY 1
      ORDER BY COUNT(*) DESC, type ASC
    `)
    .catch(() => [])

  // Merge isolir count into marketingData
  const marketingDataWithIsolir = marketingData.map((m) => ({
    ...m,
    isolir: isolirByMarketing.get(m.name.toLowerCase()) || 0
  }))

  cache.set(
    cacheKey,
    {
      packageData,
      marketingDataWithIsolir,
      monthlyData,
      yearTopPackages,
      yearMarketingCounts,
      statusCounts,
      isolationCount,
      marketingActivityTotal,
      odpTotal,
      ticketingTotal,
      ticketingYearRecap,
    },
    120_000
  )

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
      <DashboardView 
        packageData={packageData} 
        marketingData={marketingDataWithIsolir}
        monthlyData={monthlyData}
        yearTopPackages={yearTopPackages}
        yearMarketingCounts={yearMarketingCounts}
        statusCounts={statusCounts}
        marketingActivityTotal={marketingActivityTotal}
        odpTotal={odpTotal}
        ticketingTotal={ticketingTotal}
        ticketingYearRecap={ticketingYearRecap}
        initialPeriod={{ month: currentMonth, year: currentYear }}
        userRole={session.user.role}
        isolationCount={isolationCount}
      />
    </div>
  )
}
