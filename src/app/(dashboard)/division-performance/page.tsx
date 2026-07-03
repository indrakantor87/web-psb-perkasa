import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Prisma as PrismaSql } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureUserDivisionColumn } from '@/lib/db-init'
import { ensureOdpTable } from '@/lib/odp-init'
import {
  JAKARTA_OFFSET_MS,
  jakartaDateFromDMY,
  jakartaMonthRange,
  jakartaNow,
} from '@/lib/jakarta-time'
import { getMarketingNameMap, toDashboardMarketingLabel } from '@/lib/marketing-users'
import { DivisionPerformanceControls } from '@/components/DivisionPerformanceControls'
import { DivisionPerformanceExportButton } from '@/components/DivisionPerformanceExportButton'

export const dynamic = 'force-dynamic'

type DivisionCode =
  | 'PENJUALAN'
  | 'CS_ADMIN'
  | 'NOC_TROUBLESHOOTS'
  | 'CREATOR_DIGITAL'

type PeriodMode = 'WEEKLY' | 'MONTHLY'

type MemberRow = {
  id: number
  name: string
  username: string
  role: string
}

type SummaryCard = {
  label: string
  value: string | number
  hint: string
}

type QuickLink = {
  label: string
  href: string
  description: string
}

type SalesMarketingRow = {
  name: string
  inputTotal: number
  installedTotal: number
  backlogTotal: number
  activityTotal: number
}

type StatusRow = {
  label: string
  total: number
}

type ProblemRow = {
  label: string
  total: number
}

type TicketTypeRow = {
  type: string
  total: number
  open: number
  close: number
}

type PlatformAnalyticsRow = {
  platform: string
  reach: number
  impressions: number
  clicks: number
  engagement: number
}

type PerformerRow = {
  name: string
  primaryValue: number
  primaryLabel: string
  secondaryValue?: number
  secondaryLabel?: string
}

const divisionMeta: Record<DivisionCode, { label: string; description: string }> = {
  PENJUALAN: {
    label: 'Penjualan',
    description: 'Mengukur input PSB, pemasangan, follow up marketing, dan backlog prospek.',
  },
  CS_ADMIN: {
    label: 'CS',
    description: 'Mengukur pembukaan isolir, pemulihan layanan, dan beban tindak lanjut pelanggan.',
  },
  NOC_TROUBLESHOOTS: {
    label: 'NOC',
    description: 'Mengukur trouble ticket, penyelesaian gangguan, dan stabilitas operasional teknis.',
  },
  CREATOR_DIGITAL: {
    label: 'Creator Digital',
    description: 'Mengukur output konten, campaign, leads, dan performa analytics digital.',
  },
}

function toValidDivision(value: string | string[] | undefined): DivisionCode {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (
    raw === 'PENJUALAN' ||
    raw === 'CS_ADMIN' ||
    raw === 'NOC_TROUBLESHOOTS' ||
    raw === 'CREATOR_DIGITAL'
  ) {
    return raw
  }
  return 'PENJUALAN'
}

function toValidPeriodMode(value: string | string[] | undefined): PeriodMode {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return raw === 'WEEKLY' ? 'WEEKLY' : 'MONTHLY'
}

function toValidPeriod(
  value: string | string[] | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== 'string') return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback
  return parsed
}

function getMonthLabel(month: number) {
  return [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ][month - 1] ?? '-'
}

function getJakartaDateParts(date: Date) {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  }
}

function toJakartaYmd(date: Date) {
  const { year, month, day } = getJakartaDateParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseIsoDate(value: string | string[] | undefined) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return jakartaDateFromDMY(day, month, year)
}

function startOfJakartaWeek(anchorDate: Date) {
  const parts = getJakartaDateParts(anchorDate)
  const mondayDelta = parts.weekday === 0 ? -6 : 1 - parts.weekday
  return jakartaDateFromDMY(parts.day + mondayDelta, parts.month, parts.year)
}

function addJakartaDays(date: Date, dayDelta: number) {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS)
  const next = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() + dayDelta
    ) - JAKARTA_OFFSET_MS
  )
  return next
}

function formatDateLabel(date: Date) {
  const { day, month, year } = getJakartaDateParts(date)
  return `${day} ${getMonthLabel(month)} ${year}`
}

function formatShortDateLabel(date: Date) {
  const { day, month } = getJakartaDateParts(date)
  return `${day} ${getMonthLabel(month)}`
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatPercent(value: number) {
  return `${formatDecimal(value, 1)}%`
}

function mergeMarketingNames(rows: SalesMarketingRow[], nameMap: Map<string, string>) {
  const merged = new Map<string, SalesMarketingRow>()
  for (const row of rows) {
    const label = toDashboardMarketingLabel(row.name, nameMap)
    const existing = merged.get(label)
    if (existing) {
      existing.inputTotal += row.inputTotal
      existing.installedTotal += row.installedTotal
      existing.backlogTotal += row.backlogTotal
      existing.activityTotal += row.activityTotal
      continue
    }
    merged.set(label, { ...row, name: label })
  }

  return Array.from(merged.values()).sort(
    (a, b) =>
      b.installedTotal - a.installedTotal ||
      b.inputTotal - a.inputTotal ||
      a.name.localeCompare(b.name)
  )
}

export default async function DivisionPerformancePage({
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
  const mode = toValidPeriodMode(params.mode)
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const month = toValidPeriod(params.month, currentMonth, 1, 12)
  const year = toValidPeriod(params.year, currentYear, 2024, 2100)
  const anchorDate = parseIsoDate(params.date) ?? now
  const { label, description } = divisionMeta[division]

  const periodRange =
    mode === 'MONTHLY'
      ? (() => {
          const range = jakartaMonthRange(year, month)
          return {
            start: range.start,
            end: range.end,
            month,
            year,
            anchorDate: toJakartaYmd(range.start),
            label: `${getMonthLabel(month)} ${year}`,
            badge: 'Bulanan',
          }
        })()
      : (() => {
          const start = startOfJakartaWeek(anchorDate)
          const end = addJakartaDays(start, 7)
          const endDisplay = addJakartaDays(end, -1)
          return {
            start,
            end,
            month: getJakartaDateParts(anchorDate).month,
            year: getJakartaDateParts(anchorDate).year,
            anchorDate: toJakartaYmd(anchorDate),
            label: `${formatShortDateLabel(start)} - ${formatDateLabel(endDisplay)}`,
            badge: 'Mingguan',
          }
        })()

  const quickLinks: QuickLink[] = (() => {
    if (division === 'PENJUALAN') {
      return [
        {
          label: 'Input PSB',
          href: '/input?division=PENJUALAN',
          description: 'Masuk ke formulir input pelanggan baru untuk alur PSB.',
        },
        {
          label: 'List Data',
          href: '/list?division=PENJUALAN',
          description: 'Pantau calon pelanggan, pemasangan, dan backlog prospek.',
        },
        {
          label: 'Aktivitas Marketing',
          href: '/marketing-activities?division=PENJUALAN',
          description: 'Lihat intensitas aktivitas lapangan dan agenda marketing.',
        },
      ]
    }

    if (division === 'CS_ADMIN') {
      return [
        {
          label: 'Isolir',
          href: '/isolir?division=CS_ADMIN',
          description: 'Pantau data isolir, pemulihan, dan tindak lanjut pelanggan.',
        },
        {
          label: 'Dismantle',
          href: '/dismantle?division=CS_ADMIN&status=OPEN',
          description: 'Akses data dismantle yang perlu ditangani oleh tim CS.',
        },
        {
          label: 'Trouble Ticket',
          href: '/trouble-ticket?division=CS_ADMIN',
          description: 'Lihat pekerjaan layanan yang berhubungan dengan pelanggan aktif.',
        },
      ]
    }

    if (division === 'NOC_TROUBLESHOOTS') {
      return [
        {
          label: 'Trouble Ticket',
          href: '/trouble-ticket?division=NOC_TROUBLESHOOTS',
          description: 'Pantau ticket teknis masuk, close, dan backlog gangguan.',
        },
        {
          label: 'PORT ODP',
          href: '/odp?division=NOC_TROUBLESHOOTS',
          description: 'Monitor aset jaringan dan kapasitas ODP aktif.',
        },
        {
          label: 'List Data',
          href: '/list?division=NOC_TROUBLESHOOTS',
          description: 'Lihat data pelanggan yang berhubungan dengan operasi teknis.',
        },
      ]
    }

    return [
      {
        label: 'Content Calendar',
        href: '/content-calendar?division=CREATOR_DIGITAL',
        description: 'Kelola perencanaan dan output konten digital.',
      },
      {
        label: 'Campaign',
        href: '/campaigns?division=CREATOR_DIGITAL',
        description: 'Pantau campaign aktif, budget, dan target channel digital.',
      },
      {
        label: 'Digital Leads',
        href: '/digital-leads?division=CREATOR_DIGITAL',
        description: 'Lacak leads masuk dan status konversinya.',
      },
      {
        label: 'Analytics',
        href: '/analytics?division=CREATOR_DIGITAL',
        description: 'Lihat reach, impressions, engagement, dan klik per platform.',
      },
    ]
  })()

  let members: MemberRow[] = []
  let summaryCards: SummaryCard[] = []
  let salesRows: SalesMarketingRow[] = []
  let statusRows: StatusRow[] = []
  let problemRows: ProblemRow[] = []
  let ticketTypeRows: TicketTypeRow[] = []
  let platformRows: PlatformAnalyticsRow[] = []
  let secondaryRows: StatusRow[] = []
  let performerRows: PerformerRow[] = []
  let performerTitle = 'Top Performer'
  let performerDescription = 'Peringkat ringkas berdasarkan indikator paling penting pada divisi ini.'
  let localNotice = ''

  try {
    await ensureUserDivisionColumn().catch(() => {})

    members = await prisma.$queryRaw<MemberRow[]>(PrismaSql.sql`
      SELECT id, name, username, role
      FROM "User"
      WHERE "division" = ${division}
      ORDER BY role ASC, name ASC
    `)

    const start = periodRange.start
    const end = periodRange.end
    const marketingNameMap = await getMarketingNameMap()

    if (division === 'PENJUALAN') {
      const [
        inputCount,
        installedCount,
        backlogCount,
        activityCount,
        avgLeadRows,
        marketingTicketRows,
        marketingActivityRows,
        packageDataRows,
      ] = await Promise.all([
        prisma.ticket.count({
          where: {
            requestDate: { gte: start, lt: end },
          },
        }),
        prisma.ticket.count({
          where: {
            installedDate: { gte: start, lt: end },
          },
        }),
        prisma.ticket.count({
          where: {
            requestDate: { lt: end },
            status: { in: ['OPEN', 'ON_PROGRESS', 'PENDING'] },
          },
        }),
        prisma.marketingActivity
          .count({
            where: {
              date: { gte: start, lt: end },
            },
          })
          .catch(() => 0),
        prisma.$queryRaw<Array<{ avg_days: number | null }>>(PrismaSql.sql`
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("installedDate" - "requestDate")) / 86400)::numeric, 1) AS avg_days
          FROM "Ticket"
          WHERE "installedDate" IS NOT NULL
            AND "installedDate" >= ${start}
            AND "installedDate" < ${end}
            AND "requestDate" IS NOT NULL
        `),
        prisma.$queryRaw<
          Array<{
            name: string
            input_total: number
            installed_total: number
            backlog_total: number
          }>
        >(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown') AS name,
            SUM(CASE WHEN "requestDate" >= ${start} AND "requestDate" < ${end} THEN 1 ELSE 0 END)::int AS input_total,
            SUM(CASE WHEN "installedDate" IS NOT NULL AND "installedDate" >= ${start} AND "installedDate" < ${end} THEN 1 ELSE 0 END)::int AS installed_total,
            SUM(CASE WHEN "requestDate" < ${end} AND "status" IN ('OPEN', 'ON_PROGRESS', 'PENDING') THEN 1 ELSE 0 END)::int AS backlog_total
          FROM "Ticket"
          GROUP BY 1
          ORDER BY installed_total DESC, input_total DESC, name ASC
          LIMIT 15
        `),
        prisma.$queryRaw<Array<{ name: string; activity_total: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM("marketingName"), ''), 'Unknown') AS name,
            COUNT(*)::int AS activity_total
          FROM "MarketingActivity"
          WHERE "date" >= ${start}
            AND "date" < ${end}
          GROUP BY 1
          ORDER BY activity_total DESC, name ASC
        `).catch(() => []),
        prisma.$queryRaw<Array<{ label: string; total: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM("package"), ''), 'Unknown') AS label,
            COUNT(*)::int AS total
          FROM "Ticket"
          WHERE "installedDate" IS NOT NULL
            AND "installedDate" >= ${start}
            AND "installedDate" < ${end}
          GROUP BY 1
          ORDER BY total DESC, label ASC
          LIMIT 10
        `),
      ])

      const avgLeadTime = Number(avgLeadRows[0]?.avg_days || 0)
      const conversionRate = inputCount > 0 ? (installedCount / inputCount) * 100 : 0
      const activityByMarketing = new Map(
        marketingActivityRows.map((row) => [String(row.name || ''), Number(row.activity_total || 0)])
      )

      salesRows = mergeMarketingNames(
        marketingTicketRows.map((row) => ({
          name: String(row.name || ''),
          inputTotal: Number(row.input_total || 0),
          installedTotal: Number(row.installed_total || 0),
          backlogTotal: Number(row.backlog_total || 0),
          activityTotal: activityByMarketing.get(String(row.name || '')) || 0,
        })),
        marketingNameMap
      )

      summaryCards = [
        { label: 'Input PSB', value: inputCount, hint: `Data masuk pada ${periodRange.badge.toLowerCase()} ini` },
        { label: 'Pemasangan', value: installedCount, hint: 'Tiket dengan tanggal pasang pada periode ini' },
        { label: 'Conversion Rate', value: formatPercent(conversionRate), hint: 'Pemasangan dibanding input baru' },
        { label: 'Aktivitas Marketing', value: activityCount, hint: 'Aktivitas lapangan yang tercatat' },
        { label: 'Backlog Open', value: backlogCount, hint: 'Prospek yang masih perlu follow up' },
        { label: 'Lead Time Rata-rata', value: `${formatDecimal(avgLeadTime)} hari`, hint: 'Rata-rata dari input ke pemasangan' },
      ]
      problemRows = packageDataRows.map((row) => ({
        label: String(row.label || 'Unknown'),
        total: Number(row.total || 0),
      }))
      performerTitle = 'Top Marketing'
      performerDescription =
        'Diurutkan berdasarkan pemasangan terbanyak, lalu total input dan aktivitas marketing.'
      performerRows = salesRows.slice(0, 5).map((row) => ({
        name: row.name,
        primaryValue: row.installedTotal,
        primaryLabel: 'Pemasangan',
        secondaryValue: row.activityTotal,
        secondaryLabel: 'Aktivitas',
      }))
    }

    if (division === 'CS_ADMIN') {
      const [
        newIsolationCount,
        restoredCount,
        openNowCount,
        dismantleReadyCount,
        avgRestoreRows,
        rawStatusRows,
        rawMarketingRows,
        rawRadbooxRows,
      ] = await Promise.all([
        prisma.isolation.count({
          where: {
            isolationDate: { gte: start, lt: end },
          },
        }),
        prisma.isolation.count({
          where: {
            restorationDate: { gte: start, lt: end },
          },
        }),
        prisma.isolation.count({
          where: {
            status: 'OPEN',
          },
        }),
        prisma.isolation.count({
          where: {
            status: 'OPEN',
            ticketDismantle: {
              not: null,
            },
          },
        }),
        prisma.$queryRaw<Array<{ avg_days: number | null }>>(PrismaSql.sql`
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("restorationDate" - "isolationDate")) / 86400)::numeric, 1) AS avg_days
          FROM "Isolation"
          WHERE "restorationDate" IS NOT NULL
            AND "restorationDate" >= ${start}
            AND "restorationDate" < ${end}
        `),
        prisma.$queryRaw<Array<{ label: string; total: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM(UPPER("status")), ''), 'UNKNOWN') AS label,
            COUNT(*)::int AS total
          FROM "Isolation"
          GROUP BY 1
          ORDER BY total DESC, label ASC
        `),
        prisma.$queryRaw<Array<{ label: string; total: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM("marketing"), ''), 'Unknown') AS label,
            COUNT(*)::int AS total
          FROM "Isolation"
          WHERE "isolationDate" >= ${start}
            AND "isolationDate" < ${end}
          GROUP BY 1
          ORDER BY total DESC, label ASC
          LIMIT 10
        `),
        prisma.$queryRaw<Array<{ label: string; total: number }>>(PrismaSql.sql`
          SELECT
            COALESCE(NULLIF(TRIM("radboox"), ''), 'UNKNOWN') AS label,
            COUNT(*)::int AS total
          FROM "Isolation"
          WHERE "isolationDate" >= ${start}
            AND "isolationDate" < ${end}
          GROUP BY 1
          ORDER BY total DESC, label ASC
          LIMIT 10
        `),
      ])

      const avgRestoreDays = Number(avgRestoreRows[0]?.avg_days || 0)
      const closeRate = newIsolationCount > 0 ? (restoredCount / newIsolationCount) * 100 : 0

      summaryCards = [
        { label: 'Isolir Baru', value: newIsolationCount, hint: `Data isolir yang dibuat pada ${periodRange.badge.toLowerCase()} ini` },
        { label: 'Restorasi', value: restoredCount, hint: 'Pelanggan yang kembali normal pada periode ini' },
        { label: 'Close Rate', value: formatPercent(closeRate), hint: 'Restorasi dibanding isolir baru' },
        { label: 'Isolir Aktif', value: openNowCount, hint: 'Akumulasi data yang masih berstatus OPEN' },
        { label: 'Siap Dismantle', value: dismantleReadyCount, hint: 'Data isolir terbuka dengan tiket dismantle' },
        { label: 'Siklus Rata-rata', value: `${formatDecimal(avgRestoreDays)} hari`, hint: 'Rata-rata dari isolir ke restorasi' },
      ]

      statusRows = rawStatusRows.map((row) => ({
        label: String(row.label || 'UNKNOWN'),
        total: Number(row.total || 0),
      }))
      secondaryRows = rawMarketingRows.map((row) => ({
        label: toDashboardMarketingLabel(String(row.label || 'Unknown'), marketingNameMap),
        total: Number(row.total || 0),
      }))
      problemRows = rawRadbooxRows.map((row) => ({
        label: String(row.label || 'UNKNOWN'),
        total: Number(row.total || 0),
      }))
      performerTitle = 'Marketing Dengan Kasus Isolir Tertinggi'
      performerDescription =
        'Karena ownership CS belum tersimpan per user, ranking sementara memakai sumber marketing pada data isolir.'
      performerRows = secondaryRows.slice(0, 5).map((row) => ({
        name: row.label,
        primaryValue: row.total,
        primaryLabel: 'Kasus Isolir',
      }))
    }

    if (division === 'NOC_TROUBLESHOOTS') {
      const [openedCount, closedCount, openNowCount, avgHoursRows, rawTypeRows, rawProblemRows, rawCloserRows, odpTotal] =
        await Promise.all([
          prisma.troubleTicket.count({
            where: {
              openedAt: { gte: start, lt: end },
            },
          }),
          prisma.troubleTicket.count({
            where: {
              closedAt: { gte: start, lt: end },
            },
          }),
          prisma.troubleTicket.count({
            where: {
              status: 'OPEN',
            },
          }),
          prisma.$queryRaw<Array<{ avg_hours: number | null }>>(PrismaSql.sql`
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("closedAt" - "openedAt")) / 3600)::numeric, 1) AS avg_hours
            FROM "TroubleTicket"
            WHERE "closedAt" IS NOT NULL
              AND "closedAt" >= ${start}
              AND "closedAt" < ${end}
          `),
          prisma.$queryRaw<
            Array<{ type: string; total: number; open: number; close: number }>
          >(PrismaSql.sql`
            SELECT
              COALESCE(NULLIF(TRIM(UPPER("type")), ''), 'UNKNOWN') AS type,
              COUNT(*)::int AS total,
              SUM(CASE WHEN "status" = 'OPEN' THEN 1 ELSE 0 END)::int AS open,
              SUM(CASE WHEN "status" = 'CLOSE' THEN 1 ELSE 0 END)::int AS close
            FROM "TroubleTicket"
            WHERE "openedAt" >= ${start}
              AND "openedAt" < ${end}
            GROUP BY 1
            ORDER BY total DESC, type ASC
          `),
          prisma.$queryRaw<Array<{ label: string; total: number }>>(PrismaSql.sql`
            SELECT
              COALESCE(NULLIF(TRIM(UPPER("problemCategory")), ''), 'UNKNOWN') AS label,
              COUNT(*)::int AS total
            FROM "TroubleTicket"
            WHERE "openedAt" >= ${start}
              AND "openedAt" < ${end}
            GROUP BY 1
            ORDER BY total DESC, label ASC
            LIMIT 12
          `),
          prisma.$queryRaw<Array<{ name: string; total: number }>>(PrismaSql.sql`
            SELECT
              COALESCE(NULLIF(TRIM("closeBy"), ''), 'UNKNOWN') AS name,
              COUNT(*)::int AS total
            FROM "TroubleTicket"
            WHERE "closedAt" IS NOT NULL
              AND "closedAt" >= ${start}
              AND "closedAt" < ${end}
            GROUP BY 1
            ORDER BY total DESC, name ASC
            LIMIT 10
          `),
          (async () => {
            try {
              await ensureOdpTable()
              const rows = await prisma.$queryRaw<Array<{ total: number }>>(PrismaSql.sql`
                SELECT COUNT(*)::int AS total
                FROM psb_odp
                WHERE is_active = TRUE
              `)
              return Number(rows[0]?.total || 0)
            } catch {
              return 0
            }
          })(),
        ])

      const closeRate = openedCount > 0 ? (closedCount / openedCount) * 100 : 0
      const avgHours = Number(avgHoursRows[0]?.avg_hours || 0)

      summaryCards = [
        { label: 'Ticket Masuk', value: openedCount, hint: `Trouble ticket dibuka pada ${periodRange.badge.toLowerCase()} ini` },
        { label: 'Ticket Close', value: closedCount, hint: 'Ticket yang selesai pada periode ini' },
        { label: 'Close Rate', value: formatPercent(closeRate), hint: 'Close dibanding ticket masuk' },
        { label: 'Backlog Open', value: openNowCount, hint: 'Akumulasi ticket yang masih terbuka' },
        { label: 'Waktu Selesai', value: `${formatDecimal(avgHours)} jam`, hint: 'Rata-rata durasi open ke close' },
        { label: 'ODP Aktif', value: odpTotal, hint: 'Aset jaringan yang masih aktif di sistem' },
      ]

      ticketTypeRows = rawTypeRows.map((row) => ({
        type: String(row.type || 'UNKNOWN'),
        total: Number(row.total || 0),
        open: Number(row.open || 0),
        close: Number(row.close || 0),
      }))
      problemRows = rawProblemRows.map((row) => ({
        label: String(row.label || 'UNKNOWN'),
        total: Number(row.total || 0),
      }))
      performerTitle = 'Top Closer Teknis'
      performerDescription =
        'Diurutkan berdasarkan jumlah ticket yang di-close pada periode aktif.'
      performerRows = rawCloserRows.map((row) => ({
        name: String(row.name || 'UNKNOWN'),
        primaryValue: Number(row.total || 0),
        primaryLabel: 'Ticket Close',
      }))
    }

    if (division === 'CREATOR_DIGITAL') {
      try {
        const [
          contentCreated,
          contentPublished,
          activeCampaigns,
          leadsIncoming,
          leadsConverted,
          analyticsSummaryRows,
          rawLeadStatusRows,
          rawPlatformRows,
          rawCreatorRows,
        ] = await Promise.all([
          prisma.$queryRaw<Array<{ total: number }>>(PrismaSql.sql`
            SELECT COUNT(*)::int AS total
            FROM "ContentCalendar"
            WHERE "createdAt" >= ${start}
              AND "createdAt" < ${end}
          `),
          prisma.$queryRaw<Array<{ total: number }>>(PrismaSql.sql`
            SELECT COUNT(*)::int AS total
            FROM "ContentCalendar"
            WHERE "status" = 'PUBLISHED'
              AND "publishDate" IS NOT NULL
              AND "publishDate" >= ${start}
              AND "publishDate" < ${end}
          `),
          prisma.$queryRaw<Array<{ total: number }>>(PrismaSql.sql`
            SELECT COUNT(*)::int AS total
            FROM "Campaign"
            WHERE "startDate" < ${end}
              AND COALESCE("endDate", ${end}) >= ${start}
              AND "status" = 'ACTIVE'
          `),
          prisma.$queryRaw<Array<{ total: number }>>(PrismaSql.sql`
            SELECT COUNT(*)::int AS total
            FROM "DigitalLead"
            WHERE "createdAt" >= ${start}
              AND "createdAt" < ${end}
          `),
          prisma.$queryRaw<Array<{ total: number }>>(PrismaSql.sql`
            SELECT COUNT(*)::int AS total
            FROM "DigitalLead"
            WHERE "status" = 'CONVERTED'
              AND "updatedAt" >= ${start}
              AND "updatedAt" < ${end}
          `),
          prisma.$queryRaw<
            Array<{
              reach: number
              impressions: number
              clicks: number
              engagement: number
            }>
          >(PrismaSql.sql`
            SELECT
              COALESCE(SUM("reach"), 0)::int AS reach,
              COALESCE(SUM("impressions"), 0)::int AS impressions,
              COALESCE(SUM("clicks"), 0)::int AS clicks,
              COALESCE(SUM("likes" + "comments" + "shares" + "saves"), 0)::int AS engagement
            FROM "ContentAnalytics"
            WHERE "date" >= ${start}
              AND "date" < ${end}
          `),
          prisma.$queryRaw<Array<{ label: string; total: number }>>(PrismaSql.sql`
            SELECT
              COALESCE(NULLIF(TRIM(UPPER("status")), ''), 'UNKNOWN') AS label,
              COUNT(*)::int AS total
            FROM "DigitalLead"
            WHERE "createdAt" >= ${start}
              AND "createdAt" < ${end}
            GROUP BY 1
            ORDER BY total DESC, label ASC
          `),
          prisma.$queryRaw<
            Array<{
              platform: string
              reach: number
              impressions: number
              clicks: number
              engagement: number
            }>
          >(PrismaSql.sql`
            SELECT
              COALESCE(NULLIF(TRIM(UPPER("platform")), ''), 'UNKNOWN') AS platform,
              COALESCE(SUM("reach"), 0)::int AS reach,
              COALESCE(SUM("impressions"), 0)::int AS impressions,
              COALESCE(SUM("clicks"), 0)::int AS clicks,
              COALESCE(SUM("likes" + "comments" + "shares" + "saves"), 0)::int AS engagement
            FROM "ContentAnalytics"
            WHERE "date" >= ${start}
              AND "date" < ${end}
            GROUP BY 1
            ORDER BY engagement DESC, reach DESC, platform ASC
          `),
          prisma.$queryRaw<
            Array<{
              name: string
              content_total: number
              lead_total: number
            }>
          >(PrismaSql.sql`
            WITH content AS (
              SELECT "creatorId" AS user_id, COUNT(*)::int AS content_total
              FROM "ContentCalendar"
              WHERE "createdAt" >= ${start}
                AND "createdAt" < ${end}
              GROUP BY 1
            ),
            leads AS (
              SELECT "createdById" AS user_id, COUNT(*)::int AS lead_total
              FROM "DigitalLead"
              WHERE "createdAt" >= ${start}
                AND "createdAt" < ${end}
              GROUP BY 1
            )
            SELECT
              u."name" AS name,
              COALESCE(content.content_total, 0)::int AS content_total,
              COALESCE(leads.lead_total, 0)::int AS lead_total
            FROM "User" u
            LEFT JOIN content ON content.user_id = u.id
            LEFT JOIN leads ON leads.user_id = u.id
            WHERE COALESCE(NULLIF(TRIM(u."division"), ''), '') = 'CREATOR_DIGITAL'
              AND (COALESCE(content.content_total, 0) > 0 OR COALESCE(leads.lead_total, 0) > 0)
            ORDER BY content_total DESC, lead_total DESC, name ASC
            LIMIT 10
          `),
        ])

        const analyticsSummary = analyticsSummaryRows[0] ?? {
          reach: 0,
          impressions: 0,
          clicks: 0,
          engagement: 0,
        }
        const leadCount = Number(leadsIncoming[0]?.total || 0)
        const convertedCount = Number(leadsConverted[0]?.total || 0)
        const conversionRate = leadCount > 0 ? (convertedCount / leadCount) * 100 : 0

        summaryCards = [
          { label: 'Konten Dibuat', value: Number(contentCreated[0]?.total || 0), hint: 'Output content calendar pada periode ini' },
          { label: 'Konten Publish', value: Number(contentPublished[0]?.total || 0), hint: 'Konten published sesuai jadwal periode ini' },
          { label: 'Campaign Aktif', value: Number(activeCampaigns[0]?.total || 0), hint: 'Campaign yang overlap dengan periode laporan' },
          { label: 'Leads Masuk', value: leadCount, hint: 'Leads baru dari channel digital' },
          { label: 'Lead Converted', value: convertedCount, hint: `Conversion rate ${formatPercent(conversionRate)}` },
          { label: 'Total Reach', value: formatDecimal(Number(analyticsSummary.reach || 0), 0), hint: `Engagement ${formatDecimal(Number(analyticsSummary.engagement || 0), 0)}` },
        ]

        statusRows = rawLeadStatusRows.map((row) => ({
          label: String(row.label || 'UNKNOWN'),
          total: Number(row.total || 0),
        }))
        platformRows = rawPlatformRows.map((row) => ({
          platform: String(row.platform || 'UNKNOWN'),
          reach: Number(row.reach || 0),
          impressions: Number(row.impressions || 0),
          clicks: Number(row.clicks || 0),
          engagement: Number(row.engagement || 0),
        }))
        secondaryRows = [
          { label: 'Impressions', total: Number(analyticsSummary.impressions || 0) },
          { label: 'Clicks', total: Number(analyticsSummary.clicks || 0) },
          { label: 'Engagement', total: Number(analyticsSummary.engagement || 0) },
        ]
        performerTitle = 'Top Contributor Digital'
        performerDescription =
          'Diurutkan berdasarkan jumlah konten yang dibuat, lalu jumlah leads yang masuk pada periode aktif.'
        performerRows = rawCreatorRows.map((row) => ({
          name: String(row.name || 'Unknown'),
          primaryValue: Number(row.content_total || 0),
          primaryLabel: 'Konten',
          secondaryValue: Number(row.lead_total || 0),
          secondaryLabel: 'Leads',
        }))
      } catch {
        summaryCards = [
          { label: 'Konten Dibuat', value: 0, hint: 'Belum ada data pada periode ini' },
          { label: 'Konten Publish', value: 0, hint: 'Belum ada data pada periode ini' },
          { label: 'Campaign Aktif', value: 0, hint: 'Belum ada data pada periode ini' },
          { label: 'Leads Masuk', value: 0, hint: 'Belum ada data pada periode ini' },
        ]
        localNotice =
          'Modul Creator Digital sudah aktif, tetapi data KPI digital belum tersedia lengkap di database saat ini.'
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      localNotice =
        'Mode lokal aktif: laporan divisi ditampilkan dengan data terbatas karena koneksi database remote sedang tidak tersedia.'
    } else {
      throw error
    }
  }

  const exportSheets = [
    {
      name: 'Ringkasan',
      rows: summaryCards.map((card) => ({
        KPI: card.label,
        Nilai: String(card.value),
        Catatan: card.hint,
      })),
    },
    {
      name: 'Anggota Divisi',
      rows: members.map((member) => ({
        Nama: member.name,
        Username: member.username,
        Role: member.role,
      })),
    },
    ...(performerRows.length > 0
      ? [
          {
            name: 'Top Performer',
            rows: performerRows.map((row, index) => ({
              Peringkat: index + 1,
              Nama: row.name,
              [row.primaryLabel]: row.primaryValue,
              ...(row.secondaryLabel ? { [row.secondaryLabel]: row.secondaryValue ?? 0 } : {}),
            })),
          },
        ]
      : []),
    ...(salesRows.length > 0
      ? [
          {
            name: 'Performa Marketing',
            rows: salesRows.map((row) => ({
              Marketing: row.name,
              Input_PSB: row.inputTotal,
              Pemasangan: row.installedTotal,
              Aktivitas: row.activityTotal,
              Backlog: row.backlogTotal,
            })),
          },
        ]
      : []),
    ...(statusRows.length > 0
      ? [
          {
            name: 'Status',
            rows: statusRows.map((row) => ({
              Status: row.label,
              Total: row.total,
            })),
          },
        ]
      : []),
    ...(secondaryRows.length > 0
      ? [
          {
            name: 'Pendukung',
            rows: secondaryRows.map((row) => ({
              Label: row.label,
              Total: row.total,
            })),
          },
        ]
      : []),
    ...(problemRows.length > 0
      ? [
          {
            name: 'Analisis',
            rows: problemRows.map((row) => ({
              Label: row.label,
              Total: row.total,
            })),
          },
        ]
      : []),
    ...(ticketTypeRows.length > 0
      ? [
          {
            name: 'Type Ticket',
            rows: ticketTypeRows.map((row) => ({
              Type: row.type,
              Open: row.open,
              Close: row.close,
              Total: row.total,
            })),
          },
        ]
      : []),
    ...(platformRows.length > 0
      ? [
          {
            name: 'Platform Analytics',
            rows: platformRows.map((row) => ({
              Platform: row.platform,
              Reach: row.reach,
              Impressions: row.impressions,
              Clicks: row.clicks,
              Engagement: row.engagement,
            })),
          },
        ]
      : []),
  ]

  const exportFileName = `Laporan_${label.replaceAll(' ', '_')}_${periodRange.badge}_${periodRange.anchorDate}.xlsx`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Link
            href={`/?month=${periodRange.month}&year=${periodRange.year}&division=${division}`}
            className="inline-flex text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
          >
            Kembali ke Dashboard
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Laporan Kinerja Divisi {label}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <div className="font-semibold text-gray-900 dark:text-white">{periodRange.badge}</div>
          <div className="mt-1">{periodRange.label}</div>
        </div>
      </div>

      <DivisionPerformanceControls
        division={division}
        mode={mode}
        month={periodRange.month}
        year={periodRange.year}
        anchorDate={periodRange.anchorDate}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Laporan ini siap dipakai untuk review {periodRange.badge.toLowerCase()} dan evaluasi kinerja per divisi.
        </div>
        <DivisionPerformanceExportButton fileName={exportFileName} sheets={exportSheets} />
      </div>

      {localNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {localNotice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {card.label}
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{card.hint}</div>
          </div>
        ))}
      </div>

      {performerRows.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{performerTitle}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{performerDescription}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              Total ranking: <span className="font-semibold">{performerRows.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {performerRows.map((row, index) => (
              <div
                key={`${row.name}-${index}`}
                className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Peringkat {index + 1}
                    </div>
                    <div className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                      {row.name}
                    </div>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {row.primaryLabel}: {formatDecimal(row.primaryValue, 0)}
                  </div>
                </div>
                {row.secondaryLabel && (
                  <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                    {row.secondaryLabel}: <span className="font-semibold">{formatDecimal(row.secondaryValue ?? 0, 0)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Shortcut Operasional
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Akses cepat ke modul yang paling sering dipakai untuk divisi ini.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            Periode laporan aktif: <span className="font-semibold">{periodRange.label}</span>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              User yang saat ini terpetakan ke divisi {label}.
            </p>
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
              <div
                key={member.id}
                className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
              >
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
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Input, pemasangan, backlog, dan aktivitas per marketing.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Marketing</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Input</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Pasang</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Aktivitas</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Backlog</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {salesRows.map((row) => (
                    <tr key={row.name}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200">{row.name}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{row.inputTotal}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{row.installedTotal}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{row.activityTotal}</td>
                      <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900 dark:text-white">{row.backlogTotal}</td>
                    </tr>
                  ))}
                  {salesRows.length === 0 && (
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Paket Terpasang Teratas</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Komposisi paket berdasarkan pemasangan pada periode aktif.
            </p>
            <div className="space-y-3">
              {problemRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.label}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{row.total}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {division === 'CS_ADMIN' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Status Isolir Saat Ini</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Komposisi status keseluruhan pada data isolir.
            </p>
            <div className="space-y-3">
              {statusRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.label}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{row.total}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Marketing Dengan Isolir Terbanyak</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Data isolir baru pada periode aktif, dikelompokkan berdasarkan marketing.
            </p>
            <div className="space-y-3">
              {secondaryRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.label}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{row.total}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 xl:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Radboox Dominan</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Perangkat atau identifier yang paling sering muncul pada data isolir periode aktif.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {problemRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.label}</div>
                  <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{row.total}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {division === 'NOC_TROUBLESHOOTS' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rekap Ticket per Type</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Distribusi ticket yang dibuka pada periode aktif.
            </p>
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
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Problem Category Dominan</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Kategori gangguan yang paling sering muncul pada periode aktif.
            </p>
            <div className="space-y-3">
              {problemRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.label}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{row.total}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {division === 'CREATOR_DIGITAL' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Status Leads</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Distribusi status leads yang masuk pada periode aktif.
            </p>
            <div className="space-y-3">
              {statusRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.label}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{row.total}</div>
                </div>
              ))}
            </div>

            {secondaryRows.length > 0 && (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {secondaryRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{row.label}</div>
                    <div className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{formatDecimal(row.total, 0)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics per Platform</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Reach, impressions, klik, dan engagement pada periode aktif.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Platform</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Reach</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Impressions</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Clicks</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Engagement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {platformRows.map((row) => (
                    <tr key={row.platform}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200">{row.platform}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{formatDecimal(row.reach, 0)}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{formatDecimal(row.impressions, 0)}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-200">{formatDecimal(row.clicks, 0)}</td>
                      <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900 dark:text-white">{formatDecimal(row.engagement, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
