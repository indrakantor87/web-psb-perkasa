import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Prisma as PrismaSql } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureUserDivisionColumn } from '@/lib/db-init'
import { jakartaMonthRange, jakartaNow, JAKARTA_OFFSET_MS } from '@/lib/jakarta-time'
import { getMarketingNameMap, toDashboardMarketingLabel } from '@/lib/marketing-users'

export const dynamic = 'force-dynamic'

type DivisionCode = 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'

type MemberRow = {
  id: number
  name: string
  username: string
  role: string
}

type SummaryCard = {
  label: string
  value: number
  hint: string
}

type MarketingRow = {
  name: string
  total: number
  open: number
  on_progress: number
  close: number
}

type TicketTypeRow = {
  type: string
  total: number
  open: number
  close: number
}

type ProblemRow = {
  problemCategory: string
  total: number
}

type IsolationStatusRow = {
  status: string
  total: number
}

type QuickLink = {
  label: string
  href: string
  description: string
}

const divisionMeta: Record<DivisionCode, { label: string; description: string }> = {
  PENJUALAN: {
    label: 'Penjualan',
    description: 'Fokus pada PSB, aktivitas marketing, dan performa pemasangan.',
  },
  CS_ADMIN: {
    label: 'CS & Admin CS',
    description: 'Fokus pada isolir aktif, tindak lanjut pelanggan, dan koordinasi layanan.',
  },
  NOC_TROUBLESHOOTS: {
    label: 'NOC & Troubleshoots',
    description: 'Fokus pada penanganan gangguan, open-close ticket, dan problem teknis.',
  },
  CREATOR_DIGITAL: {
    label: 'Creator Digital',
    description: 'Divisi digital sudah disiapkan, namun modul KPI detailnya belum aktif.',
  },
}

function toValidDivision(value: string | string[] | undefined): DivisionCode {
  const raw = typeof value === 'string' ? value : ''
  if (raw === 'PENJUALAN' || raw === 'CS_ADMIN' || raw === 'NOC_TROUBLESHOOTS' || raw === 'CREATOR_DIGITAL') {
    return raw
  }
  return 'PENJUALAN'
}

function toValidPeriod(value: string | string[] | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== 'string') return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback
  return parsed
}

function getMonthLabel(month: number) {
  return ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][month - 1] ?? '-'
}

function aggregateMarketingRows(rows: MarketingRow[], nameMap: Map<string, string>) {
  const aggregated = new Map<string, MarketingRow>()
  for (const row of rows) {
    const label = toDashboardMarketingLabel(row.name, nameMap)
    const existing = aggregated.get(label)
    if (existing) {
      existing.total += row.total
      existing.open += row.open
      existing.on_progress += row.on_progress
      existing.close += row.close
      continue
    }
    aggregated.set(label, { ...row, name: label })
  }

  return Array.from(aggregated.values()).sort((a, b) => b.close - a.close || b.total - a.total || a.name.localeCompare(b.name))
}

export default async function DivisionDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/')

  const params = await searchParams
  const now = jakartaNow()
  const division = toValidDivision(params.division)
  const month = toValidPeriod(params.month, now.getMonth() + 1, 1, 12)
  const year = toValidPeriod(params.year, now.getFullYear(), 2024, 2100)
  const { label, description } = divisionMeta[division]
  const quickLinks: QuickLink[] = (() => {
    const dashboardHref = `/?month=${month}&year=${year}&division=${division}`
    if (division === 'PENJUALAN') {
      return [
        { label: 'Dashboard Divisi', href: dashboardHref, description: 'Kembali ke dashboard admin dengan fokus Penjualan.' },
        { label: 'Input PSB', href: '/input?division=PENJUALAN', description: 'Masuk ke formulir input pelanggan baru untuk alur PSB.' },
        { label: 'List Data', href: '/list?division=PENJUALAN', description: 'Pantau data PSB yang sudah masuk dari perspektif Penjualan.' },
        { label: 'Aktivitas Marketing', href: '/marketing-activities?division=PENJUALAN', description: 'Lihat aktivitas lapangan dan agenda marketing.' },
      ]
    }
    if (division === 'CS_ADMIN') {
      return [
        { label: 'Dashboard Divisi', href: dashboardHref, description: 'Kembali ke dashboard admin dengan fokus CS & Admin CS.' },
        { label: 'Isolir Aktif', href: '/isolir?division=CS_ADMIN&status=OPEN', description: 'Pantau pelanggan yang masih berstatus isolir aktif.' },
        { label: 'Dismantle Perangkat', href: '/dismantle?division=CS_ADMIN', description: 'Siapkan alur pembongkaran perangkat dari perspektif CS & Admin CS.' },
        { label: 'PORT ODP', href: '/odp?division=CS_ADMIN', description: 'Akses modul PORT ODP dari perspektif CS & Admin CS sesuai struktur menu terbaru.' },
        { label: 'Manajemen Pengguna', href: '/settings/users', description: 'Rapikan mapping anggota dan role di divisi layanan.' },
      ]
    }
    if (division === 'NOC_TROUBLESHOOTS') {
      return [
        { label: 'Dashboard Divisi', href: dashboardHref, description: 'Kembali ke dashboard admin dengan fokus area teknis.' },
        { label: 'PORT ODP', href: '/odp?division=NOC_TROUBLESHOOTS', description: 'Lihat kapasitas ODP dan aset jaringan dari perspektif teknis.' },
        { label: 'Trouble Ticket', href: '/trouble-ticket?division=NOC_TROUBLESHOOTS', description: 'Masuk ke ticket teknis dan progres penanganannya.' },
        { label: 'Riwayat Isolir', href: '/isolir?division=NOC_TROUBLESHOOTS', description: 'Pantau data isolir yang sudah kembali normal.' },
      ]
    }
    return [
      { label: 'Dashboard Divisi', href: dashboardHref, description: 'Kembali ke dashboard admin dengan fokus Creator Digital.' },
      { label: 'Manajemen Pengguna', href: '/settings/users', description: 'Siapkan anggota Creator Digital dan mapping division-nya.' },
      { label: 'Pengaturan Trouble Ticket', href: '/settings/trouble-ticket', description: 'Akses master data yang sudah siap dipakai lintas divisi.' },
    ]
  })()
  const focusNote = (() => {
    if (division === 'PENJUALAN') {
      return 'Divisi ini paling lengkap saat ini karena sudah terhubung ke PSB, aktivitas marketing, dan list data.'
    }
    if (division === 'CS_ADMIN') {
      return 'Fokus utama divisi ini ada pada follow up pelanggan, monitoring isolir aktif, dan koordinasi layanan tanpa data Trouble Ticket.'
    }
    if (division === 'NOC_TROUBLESHOOTS') {
      return 'Divisi ini memegang area teknis: ODP, ticket teknis, dan penyelesaian gangguan lapangan.'
    }
    return 'Divisi ini sudah siap secara struktur, tetapi KPI dan modul operasional digital masih menunggu fase implementasi berikutnya.'
  })()

  let members: MemberRow[] = []
  let summaryCards: SummaryCard[] = []
  let marketingRows: MarketingRow[] = []
  let ticketTypeRows: TicketTypeRow[] = []
  let isolationStatusRows: IsolationStatusRow[] = []
  let problemRows: ProblemRow[] = []
  let localNotice = ''

  try {
    await ensureUserDivisionColumn().catch(() => {})

    members = await prisma.$queryRaw<MemberRow[]>(PrismaSql.sql`
      SELECT
        id,
        name,
        username,
        role
      FROM "User"
      WHERE "division" = ${division}
      ORDER BY role ASC, name ASC
    `)

    const { start: startDate, end: endDate } = jakartaMonthRange(year, month)
    const isSelectedCurrentMonth = (() => {
      const current = jakartaNow()
      return current.getFullYear() === year && current.getMonth() + 1 === month
    })()
    const openStatuses = ['OPEN', 'ON_PROGRESS']
    const statusVals = PrismaSql.join(openStatuses.map((status) => PrismaSql.sql`${status}`))
    const carryClause = isSelectedCurrentMonth
      ? PrismaSql.sql`OR ("installedDate" IS NULL AND "status" IN (${statusVals}) AND "requestDate" < ${endDate})`
      : PrismaSql.sql``
    const yearStart = new Date(Date.UTC(year, 0, 1) - JAKARTA_OFFSET_MS)
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1) - JAKARTA_OFFSET_MS)
    const marketingNameMap = await getMarketingNameMap()

    if (division === 'PENJUALAN') {
      const [statusRows, activityTotal, packageRows, marketers] = await Promise.all([
        prisma.$queryRaw<Array<{ status: string; count: number }>>(PrismaSql.sql`
          SELECT "status" AS status, COUNT(*)::int AS count
          FROM "Ticket"
          WHERE (
            ("installedDate" IS NOT NULL AND "installedDate" >= ${startDate} AND "installedDate" < ${endDate})
            ${carryClause}
          )
          GROUP BY "status"
        `),
        prisma.marketingActivity.count({
          where: {
            date: { gte: startDate, lt: endDate },
          },
        }).catch(() => 0),
        prisma.$queryRaw<Array<{ package: string; count: number }>>(PrismaSql.sql`
          SELECT COALESCE(NULLIF(TRIM("package"), ''), 'Unknown') AS package, COUNT(*)::int AS count
          FROM "Ticket"
          WHERE (
            ("installedDate" IS NOT NULL AND "installedDate" >= ${startDate} AND "installedDate" < ${endDate})
            ${carryClause}
          )
          GROUP BY 1
          ORDER BY COUNT(*) DESC, package ASC
          LIMIT 8
        `),
        prisma.$queryRaw<Array<{ name: string; total: number; open: number; on_progress: number; close: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown') AS name,
            COUNT(*)::int AS total,
            SUM(CASE WHEN "status" = 'OPEN' THEN 1 ELSE 0 END)::int AS open,
            SUM(CASE WHEN "status" IN ('ON_PROGRESS', 'PENDING') THEN 1 ELSE 0 END)::int AS on_progress,
            SUM(CASE WHEN "status" = 'CLOSE' THEN 1 ELSE 0 END)::int AS close
          FROM "Ticket"
          WHERE (
            ("installedDate" IS NOT NULL AND "installedDate" >= ${startDate} AND "installedDate" < ${endDate})
            ${carryClause}
          )
          GROUP BY 1
          ORDER BY close DESC, total DESC, name ASC
          LIMIT 12
        `),
      ])

      const totalPsb = statusRows.reduce((acc, row) => acc + Number(row.count || 0), 0)
      const totalClose = Number(statusRows.find((row) => row.status === 'CLOSE')?.count || 0)
      const totalOpen = Number(statusRows.find((row) => row.status === 'OPEN')?.count || 0)
      summaryCards = [
        { label: 'PSB Periode Ini', value: totalPsb, hint: `${getMonthLabel(month)} ${year}` },
        { label: 'Aktivitas Marketing', value: Number(activityTotal || 0), hint: 'Input aktivitas pada periode ini' },
        { label: 'Status Close', value: totalClose, hint: `Open tersisa ${totalOpen}` },
      ]
      marketingRows = aggregateMarketingRows(marketers.map((row) => ({
        name: String(row.name || ''),
        total: Number(row.total || 0),
        open: Number(row.open || 0),
        on_progress: Number(row.on_progress || 0),
        close: Number(row.close || 0),
      })), marketingNameMap)
      problemRows = packageRows.map((row) => ({
        problemCategory: String(row.package || 'Unknown'),
        total: Number(row.count || 0),
      }))
    }

    if (division === 'CS_ADMIN') {
      const [statusRows, radbooxRows] = await Promise.all([
        prisma.$queryRaw<Array<{ status: string; total: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM(UPPER("status")), ''), 'UNKNOWN') AS status,
            COUNT(*)::int AS total
          FROM "Isolation"
          GROUP BY 1
          ORDER BY COUNT(*) DESC, status ASC
        `),
        prisma.$queryRaw<Array<{ radboox: string; total: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM("radboox"), ''), 'UNKNOWN') AS radboox,
            COUNT(*)::int AS total
          FROM "Isolation"
          GROUP BY 1
          ORDER BY COUNT(*) DESC, radboox ASC
          LIMIT 10
        `),
      ])

      const totalIsolir = statusRows.reduce((acc, row) => acc + Number(row.total || 0), 0)
      const totalOpen = Number(statusRows.find((row) => row.status === 'OPEN')?.total || 0)
      const totalClosed = Number(statusRows.find((row) => row.status === 'CLOSED')?.total || 0)
      summaryCards = [
        { label: 'Total Data Isolir', value: totalIsolir, hint: 'Akumulasi data isolir yang tercatat' },
        { label: 'Isolir Aktif', value: totalOpen, hint: 'Perlu tindak lanjut CS & Admin CS' },
        { label: 'Riwayat Selesai', value: totalClosed, hint: 'Status CLOSED pada data isolir' },
      ]
      isolationStatusRows = statusRows.map((row) => ({
        status: String(row.status || 'UNKNOWN'),
        total: Number(row.total || 0),
      }))
      problemRows = radbooxRows.map((row) => ({
        problemCategory: String(row.radboox || 'UNKNOWN'),
        total: Number(row.total || 0),
      }))
    }

    if (division === 'NOC_TROUBLESHOOTS') {
      const [statusRows, typeRows, yearlyProblems] = await Promise.all([
        prisma.$queryRaw<Array<{ status: string; count: number }>>(PrismaSql.sql`
          SELECT COALESCE(NULLIF(TRIM(UPPER("status")), ''), 'UNKNOWN') AS status, COUNT(*)::int AS count
          FROM "TroubleTicket"
          WHERE "periodMonth" = ${month}
            AND "periodYear" = ${year}
          GROUP BY 1
        `),
        prisma.$queryRaw<Array<{ type: string; total: number; open: number; close: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM(UPPER("type")), ''), 'UNKNOWN') AS type,
            COUNT(*)::int AS total,
            SUM(CASE WHEN "status" = 'OPEN' THEN 1 ELSE 0 END)::int AS open,
            SUM(CASE WHEN "status" = 'CLOSE' THEN 1 ELSE 0 END)::int AS close
          FROM "TroubleTicket"
          WHERE "periodMonth" = ${month}
            AND "periodYear" = ${year}
          GROUP BY 1
          ORDER BY COUNT(*) DESC, type ASC
        `),
        prisma.$queryRaw<Array<{ problemCategory: string; total: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM(UPPER("problemCategory")), ''), 'UNKNOWN') AS "problemCategory",
            COUNT(*)::int AS total
          FROM "TroubleTicket"
          WHERE "openedAt" >= ${yearStart}
            AND "openedAt" < ${yearEnd}
            AND COALESCE(NULLIF(TRIM("category"), ''), 'TT') = 'TT'
          GROUP BY 1
          ORDER BY COUNT(*) DESC, "problemCategory" ASC
          LIMIT 10
        `),
      ])

      const totalTicket = statusRows.reduce((acc, row) => acc + Number(row.count || 0), 0)
      const totalOpen = Number(statusRows.find((row) => row.status === 'OPEN')?.count || 0)
      const totalClose = Number(statusRows.find((row) => row.status === 'CLOSE')?.count || 0)
      summaryCards = [
        { label: 'Ticket Bulan Ini', value: totalTicket, hint: `${getMonthLabel(month)} ${year}` },
        { label: 'Open Ticket', value: totalOpen, hint: 'Perlu follow up' },
        { label: 'Close Ticket', value: totalClose, hint: 'Selesai pada periode ini' },
      ]
      ticketTypeRows = typeRows.map((row) => ({
        type: String(row.type || 'UNKNOWN'),
        total: Number(row.total || 0),
        open: Number(row.open || 0),
        close: Number(row.close || 0),
      }))
      problemRows = yearlyProblems.map((row) => ({
        problemCategory: String(row.problemCategory || 'UNKNOWN'),
        total: Number(row.total || 0),
      }))
    }

    if (division === 'CREATOR_DIGITAL') {
      let contentCount = 0
      let campaignCount = 0
      let leadCount = 0
      let totalReach = 0
      let totalEngagement = 0
      
      try {
        // Try to fetch Creator Digital data, fall back to 0 if models don't exist yet
        const [cc, c, l, a] = await Promise.all([
          (prisma as any).contentCalendar?.count().catch(() => 0),
          (prisma as any).campaign?.count().catch(() => 0),
          (prisma as any).digitalLead?.count().catch(() => 0),
          (prisma as any).contentAnalytics?.aggregate({
            _sum: {
              reach: true,
              impressions: true,
              likes: true,
              comments: true,
              shares: true,
              saves: true,
              clicks: true,
              followersGain: true,
            }
          }).catch(() => ({ _sum: {} }))
        ])
        
        contentCount = cc || 0
        campaignCount = c || 0
        leadCount = l || 0
        totalReach = a?._sum?.reach || 0
        totalEngagement = (a?._sum?.likes || 0) + (a?._sum?.comments || 0) + (a?._sum?.shares || 0)
      } catch {
        // Fall back to 0 if anything fails
      }

      summaryCards = [
        { label: 'Member Aktif', value: members.length, hint: 'Sudah terpetakan ke division' },
        { label: 'Total Konten', value: contentCount, hint: 'Content Calendar' },
        { label: 'Campaign Aktif', value: campaignCount, hint: 'Campaign Tracker' },
        { label: 'Digital Leads', value: leadCount, hint: 'Total leads masuk' },
        { label: 'Total Reach', value: totalReach, hint: 'Jangkauan konten' },
        { label: 'Engagement', value: totalEngagement, hint: 'Likes + Comments + Shares' },
      ]
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      localNotice = 'Mode lokal aktif: detail divisi ditampilkan dengan data terbatas karena koneksi database remote sedang tidak tersedia.'
    } else {
      throw error
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2">
            <Link
              href={`/?month=${month}&year=${year}&division=${division}`}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
            >
              Kembali ke Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Detail Divisi {label}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {description} Periode {getMonthLabel(month)} {year}.
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Kode Divisi: <span className="font-semibold text-gray-900 dark:text-white">{division}</span>
        </div>
      </div>

      {localNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {localNotice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</div>
            <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{card.value}</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Shortcut Operasional</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Akses cepat ke modul yang paling relevan untuk divisi ini.
            </p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {focusNote}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-white">{link.label}</div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Anggota Divisi</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Mapping role ke division yang saat ini aktif.</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            Total {members.length} user
          </div>
        </div>
        {members.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            Belum ada user yang terhubung ke divisi ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="font-semibold text-gray-900 dark:text-white">{member.name}</div>
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">@{member.username}</div>
                <div className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {member.role}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {division === 'PENJUALAN' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Performa Marketing</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Rangkuman individu berdasarkan data PSB pada periode ini.</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Marketing</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Close</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">On Progress</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Open</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {marketingRows.map((row) => (
                    <tr key={row.name}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200">{row.name}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{row.close}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{row.on_progress}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{row.open}</td>
                      <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900 dark:text-white">{row.total}</td>
                    </tr>
                  ))}
                  {marketingRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">
                        Belum ada data marketing untuk periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Paket Teratas</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Komposisi paket dengan pemasangan terbanyak.</p>
            <div className="space-y-3">
              {problemRows.map((row) => (
                <div key={row.problemCategory} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.problemCategory}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{row.total}</div>
                </div>
              ))}
              {problemRows.length === 0 && (
                <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400 dark:bg-gray-900">
                  Belum ada data paket untuk periode ini.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {division === 'CS_ADMIN' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rekap Status Isolir</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Status aktual data isolir yang dikelola area CS & Admin CS.</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {isolationStatusRows.map((row) => (
                    <tr key={row.status}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200">{row.status}</td>
                      <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900 dark:text-white">{row.total}</td>
                    </tr>
                  ))}
                  {isolationStatusRows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-8 text-center text-sm text-gray-400">
                        Belum ada data isolir yang tercatat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Radboox Dominan</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Perangkat Radboox yang paling sering muncul pada data isolir.</p>
            <div className="space-y-3">
              {problemRows.map((row) => (
                <div key={row.problemCategory} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.problemCategory}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{row.total}</div>
                </div>
              ))}
              {problemRows.length === 0 && (
                <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400 dark:bg-gray-900">
                  Belum ada data Radboox untuk divisi ini.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {division === 'NOC_TROUBLESHOOTS' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rekap Ticket per Type</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Open dan close ticket pada periode ini.</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Type</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Open</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Close</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {ticketTypeRows.map((row) => (
                    <tr key={row.type}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200">{row.type}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{row.open}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{row.close}</td>
                      <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900 dark:text-white">{row.total}</td>
                    </tr>
                  ))}
                  {ticketTypeRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">
                        Belum ada data trouble ticket pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {division === 'NOC_TROUBLESHOOTS' ? 'Top Problem Category' : 'Gangguan Dominan'}
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Top kategori gangguan selama tahun berjalan.</p>
            <div className="space-y-3">
              {problemRows.map((row) => (
                <div key={row.problemCategory} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.problemCategory}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{row.total}</div>
                </div>
              ))}
              {problemRows.length === 0 && (
                <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400 dark:bg-gray-900">
                  Belum ada data gangguan untuk tahun ini.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {division === 'CREATOR_DIGITAL' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Konten Terbaru</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Daftar konten yang baru ditambahkan ke Content Calendar.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Leads Terbaru</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Daftar digital leads yang baru masuk ke sistem.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
