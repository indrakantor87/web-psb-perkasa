import { DashboardView } from '@/components/DashboardView'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

// Cache dashboard selama 2 menit untuk ringkasan agar mengurangi beban DB
export const revalidate = 120

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const resolvedSearchParams = await searchParams
  const monthParam = resolvedSearchParams.month
  const yearParam = resolvedSearchParams.year

  const now = new Date()
  const currentMonth = typeof monthParam === 'string' ? parseInt(monthParam) : now.getMonth() + 1
  const currentYear = typeof yearParam === 'string' ? parseInt(yearParam) : now.getFullYear()

  const startDate = new Date(currentYear, currentMonth - 1, 1)
  const endDate = new Date(currentYear, currentMonth, 1)
  const isSelectedCurrentMonth = (() => {
    const n = new Date()
    return n.getFullYear() === currentYear && (n.getMonth() + 1) === currentMonth
  })()
  const openStatuses = ['OPEN', 'ON_PROGRESS', 'PENDING'] as const

  const where: any = {
    OR: [
      {
        AND: [
          { installedDate: { not: null } },
          { installedDate: { gte: startDate, lt: endDate } }
        ]
      },
      isSelectedCurrentMonth
        ? {
            AND: [
              { installedDate: null },
              { status: { in: openStatuses } as any },
              { requestDate: { lt: endDate } }
            ]
          }
        : undefined
    ].filter(Boolean)
  }

  if (session.user.role === 'MARKETING') {
    where.marketingName = session.user.name
  }

  // Fetch tickets for manual aggregation (workaround for Prisma groupBy issues on Vercel)
  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      package: true,
      marketingName: true,
      status: true
    }
  })

  // 1. Group by Package (normalize nama paket)
  const normalizePackage = (pkg?: string | null) => {
    const p = (pkg || 'Unknown').toUpperCase()
    if (p.includes('HOME LITE')) return 'HOME LITE'
    if (p.includes('HOME BASIC')) return 'HOME BASIC'
    if (p.includes('HOME STREAM')) return 'HOME STREAM'
    if (p.includes('HOME ENTERTAIN')) return 'HOME ENTERTAIN'
    if (p.includes('HOME SMALL')) return 'HOME SMALL'
    if (p.includes('HOME ADVAN')) return 'HOME ADVAN'
    return pkg || 'Unknown'
  }
  const packageCounts: Record<string, number> = {}
  tickets.forEach((t: any) => {
    const pkg = normalizePackage(t.package)
    packageCounts[pkg] = (packageCounts[pkg] || 0) + 1
  })

  // 2. Group by Marketing and Status
  const marketingMap = new Map<string, { name: string; open: number; pending: number; close: number; count: number }>()

  tickets.forEach((t: any) => {
    const rawName = t.marketingName || 'Unknown'
    const name = rawName.trim()
    const key = name.toLowerCase()

    const current = marketingMap.get(key) || { name, open: 0, pending: 0, close: 0, count: 0 }
    
    current.count += 1
    
    if (t.status === 'OPEN') {
      current.open += 1
    } else if (t.status === 'PENDING') {
      current.pending += 1
    } else if (t.status === 'CLOSE') {
      current.close += 1
    }
    
    marketingMap.set(key, current)
  })

  const packageOrder = ['HOME LITE', 'HOME BASIC', 'HOME STREAM', 'HOME ENTERTAIN', 'HOME SMALL', 'HOME ADVAN']

  const packageData = Object.entries(packageCounts).map(([name, count]) => ({
    name,
    count
  })).sort((a: { name: string }, b: { name: string }) => {
    const indexA = packageOrder.indexOf(a.name)
    const indexB = packageOrder.indexOf(b.name)
    
    // If both are in the list, sort by index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }
    
    // If only a is in the list, it comes first
    if (indexA !== -1) return -1
    
    // If only b is in the list, it comes first
    if (indexB !== -1) return 1
    
    // If neither, sort alphabetically
    return a.name.localeCompare(b.name)
  })

  const marketingData = Array.from(marketingMap.values())
    .sort((a, b) => b.count - a.count)

  // 2b. Monthly recap untuk tahun terpilih (Jan..Dec) – hanya berdasarkan installedDate (pemasangan selesai)
  const yearStart = new Date(currentYear, 0, 1)
  const yearEnd = new Date(currentYear + 1, 0, 1)
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

  // 3. Calculate Global Status Counts
  const statusCounts = {
    total: tickets.length,
    open: 0,
    close: 0,
    pending: 0,
    on_progress: 0
  }

  tickets.forEach((t: any) => {
    if (t.status === 'OPEN') statusCounts.open++
    else if (t.status === 'CLOSE') statusCounts.close++
    else if (t.status === 'PENDING') statusCounts.pending++
    else if (t.status === 'ON_PROGRESS') statusCounts.on_progress++
  })

  // Fetch Isolation Count (Status: OPEN) - role aware
  const isoCountWhere: any = { status: 'OPEN' }
  if (session.user.role === 'MARKETING') {
    isoCountWhere.marketing = session.user.name
  }
  const isolationCount = await prisma.isolation.count({ where: isoCountWhere })

  // Group isolation by marketing (OPEN only)
  const isoListWhere: any = { status: 'OPEN' }
  if (session.user.role === 'MARKETING') {
    isoListWhere.marketing = session.user.name
  }
  const isolations = await prisma.isolation.findMany({
    where: isoListWhere,
    select: { marketing: true }
  })
  const isolirByMarketing = new Map<string, number>()
  isolations.forEach((iso) => {
    const name = (iso.marketing || 'Unknown').trim()
    const key = name.toLowerCase()
    isolirByMarketing.set(key, (isolirByMarketing.get(key) || 0) + 1)
  })

  // Merge isolir count into marketingData
  const marketingDataWithIsolir = marketingData.map((m) => ({
    ...m,
    isolir: isolirByMarketing.get(m.name.toLowerCase()) || 0
  }))

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
        initialPeriod={{ month: currentMonth, year: currentYear }}
        userRole={session.user.role}
        isolationCount={isolationCount}
      />
    </div>
  )
}
