'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { LayoutDashboard, Calendar, User, Megaphone, Headset, ShieldCheck, Clapperboard, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getDivisionFromRole, isAdminRole } from '@/lib/access'
import { MobileHome } from '@/components/MobileHome'
import { Card, cardClassName } from '@/components/ui/Card'
import { ChartCard } from '@/components/ui/ChartCard'
import { Chip } from '@/components/ui/Chip'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { StatCard } from '@/components/ui/StatCard'
import { chartAxisTick, chartCursorFill, chartTooltipStyle } from '@/components/ui/chart'

type DivisionSummary = {
  code: 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'
  label: string
  description: string
  members: number
  primaryValue: number
  primaryLabel: string
  secondaryValue: number
  secondaryLabel: string
  extraStats?: Array<{ label: string; value: number; tone?: 'danger' | 'info' | 'success' }>
  note?: string
}

type DivisionFilter = DivisionSummary['code'] | 'ALL'

type DashboardKpiCard = {
  label: string
  value: string | number
  hint: string
}

type HrDepartmentCount = { department: string; count: number }

type HrDashboardStats = {
  activeEmployees: number
  withFingerprint: number
  presentToday: number
  absentToday: number
  departmentBreakdown: HrDepartmentCount[]
}

type GaDailyActivityStats = {
  total: number
  done: number
  planned: number
  pending: number
  cancel: number
  pendingApproval: number
  byDivision: Array<{ division: string; total: number; done: number }>
}

interface DashboardViewProps {
  packageData: { name: string; count: number }[]
  marketingData: { name: string; count: number; open: number; on_progress: number; close: number; isolir?: number }[]
  monthlyData: { name: string; count: number }[]
  yearTopPackages: { name: string; count: number }[]
  yearMarketingMonthly?: {
    months: string[]
    rows: Array<{ name: string; total: number; byMonth: number[] }>
  }
  statusCounts: { total: number; open: number; close: number; on_progress: number }
  ticketingMonthRecap: Array<{ type: string; total: number; open: number; close: number }>
  troubleTicketClosedMonthly?: { months: string[]; counts: number[] }
  troubleTicketProblemMonthly?: {
    months: string[]
    rows: Array<{ problemCategory: string; total: number; byMonth: number[] }>
  }
  initialPeriod: { month: number; year: number }
  userRole?: string
  userName?: string
  divisionSummary?: DivisionSummary[]
  focusedDivisionKpis?: DashboardKpiCard[]
  selectedDivision?: DivisionFilter
  hrStats?: HrDashboardStats
  gaDailyActivityStats?: GaDailyActivityStats
}

export function DashboardView({ packageData, marketingData, monthlyData, yearTopPackages, yearMarketingMonthly, statusCounts, ticketingMonthRecap, troubleTicketClosedMonthly, troubleTicketProblemMonthly, initialPeriod, userRole, userName, divisionSummary = [], focusedDivisionKpis = [], selectedDivision = 'ALL', hrStats, gaDailyActivityStats }: DashboardViewProps) {
  const router = useRouter()
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)
  const month = initialPeriod.month
  const year = initialPeriod.year

  // Pull to refresh support
  useEffect(() => {
    const handler = () => {
      router.refresh()
    }
    window.addEventListener('app:refresh', handler)
    return () => window.removeEventListener('app:refresh', handler)
  }, [router])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px) and (orientation: portrait)')
    const update = () => setIsMobilePortrait(mq.matches)
    update()

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    }

    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])
  const isMarketing = userRole === 'MARKETING'
  const isTeknisi = userRole === 'TEKNISI'
  const isNoc = userRole === 'NOC'
  const isAdmin = isAdminRole(userRole)
  const roleUpper = String(userRole ?? '').trim().toUpperCase()
  const isCsRole = roleUpper === 'CS' || roleUpper === 'ADMIN_CS'
  const roleDivision = getDivisionFromRole(userRole)
  const focusedDivision = isAdmin ? selectedDivision : roleDivision

  const defaultMonthShort = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'], [])

  const troubleMonths = troubleTicketProblemMonthly?.months ?? defaultMonthShort
  const troubleVisibleMonthIdx = useMemo(() => {
    return troubleMonths.map((_, i) => i)
  }, [troubleMonths])

  const marketingMonths = yearMarketingMonthly?.months ?? defaultMonthShort
  const marketingVisibleMonthIdx = useMemo(() => {
    return marketingMonths.map((_, i) => i)
  }, [marketingMonths])

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]

  const years = [2024, 2025, 2026, 2027]

  const totalOpen = marketingData.reduce((acc, curr) => acc + curr.open, 0)
  const totalOnProgress = marketingData.reduce((acc, curr) => acc + curr.on_progress, 0)
  const totalClose = marketingData.reduce((acc, curr) => acc + curr.close, 0)
  const totalCount = marketingData.reduce((acc, curr) => acc + curr.count, 0)
  const totalIsolir = marketingData.reduce((acc, curr) => acc + (curr.isolir || 0), 0)

  const psbYearSeries = useMemo(() => {
    const rows = (monthlyData ?? []).map((m) => ({ label: String(m.name ?? '').trim() || '-', total: Number(m.count || 0) }))
    return rows.filter((x) => x.total > 0)
  }, [monthlyData])

  const psbYearTotal = useMemo(() => psbYearSeries.reduce((acc, x) => acc + x.total, 0), [psbYearSeries])

  const ticketingTotals = useMemo(() => {
    const open = (ticketingMonthRecap ?? []).reduce((acc, r) => acc + Number(r.open ?? 0), 0)
    const close = (ticketingMonthRecap ?? []).reduce((acc, r) => acc + Number(r.close ?? 0), 0)
    return { open, close, total: open + close }
  }, [ticketingMonthRecap])

  const ticketingPieData = useMemo(
    () =>
      [
        { name: 'OPEN', value: Number(ticketingTotals.open || 0), color: '#ef4444' },
        { name: 'CLOSE', value: Number(ticketingTotals.close || 0), color: '#10b981' },
      ].filter((x) => x.value > 0),
    [ticketingTotals.close, ticketingTotals.open]
  )

  const statusPieData = useMemo(() => ([
    { name: 'OPEN', value: Number(statusCounts.open || 0), color: '#ef4444' },
    { name: 'ON PROGRESS', value: Number(statusCounts.on_progress || 0), color: '#3b82f6' },
    { name: 'CLOSE', value: Number(statusCounts.close || 0), color: '#10b981' },
  ]).filter((x) => x.value > 0), [statusCounts.close, statusCounts.on_progress, statusCounts.open])

  const packageBarData = useMemo(() => {
    const rows = (packageData ?? [])
      .map((r) => ({ name: String(r.name || 'Unknown'), count: Number(r.count || 0) }))
      .filter((r) => r.count > 0)
    rows.sort((a, b) => b.count - a.count)
    return rows.slice(0, 7)
  }, [packageData])

  const yearTopPackageBarData = useMemo(() => {
    const rows = (yearTopPackages ?? [])
      .map((r) => ({ name: String(r.name || 'Unknown'), count: Number(r.count || 0) }))
      .filter((r) => r.count > 0)
    rows.sort((a, b) => b.count - a.count)
    return rows.slice(0, 5)
  }, [yearTopPackages])

  const ticketingBarData = useMemo(() => {
    return (ticketingMonthRecap ?? []).map((r) => ({
      name: String(r.type || '-'),
      open: Number(r.open || 0),
      close: Number(r.close || 0),
    }))
  }, [ticketingMonthRecap])

  const troubleTopData = useMemo(() => {
    const rows = (troubleTicketProblemMonthly?.rows ?? [])
      .map((r) => ({ name: String(r.problemCategory || '-'), total: Number(r.total || 0) }))
      .filter((r) => r.total > 0)
    rows.sort((a, b) => b.total - a.total)
    return rows.slice(0, 7)
  }, [troubleTicketProblemMonthly?.rows])

  const troubleCloseYearSeries = useMemo(() => {
    const months = (troubleTicketClosedMonthly?.months ?? defaultMonthShort).map((m) => String(m ?? '').trim() || '-')
    const counts = troubleTicketClosedMonthly?.counts ?? []
    const totals = months.map((label, i) => ({ label, total: Number(counts[i] ?? 0) }))
    return totals.filter((x) => x.total > 0)
  }, [defaultMonthShort, troubleTicketClosedMonthly?.counts, troubleTicketClosedMonthly?.months])

  const troubleCloseYearTotal = useMemo(() => troubleCloseYearSeries.reduce((acc, x) => acc + x.total, 0), [troubleCloseYearSeries])

  const packageChartWidth = useMemo(() => Math.max(360, packageBarData.length * 90), [packageBarData.length])
  const ticketingChartWidth = useMemo(() => Math.max(360, ticketingBarData.length * 110), [ticketingBarData.length])
  const troubleChartWidth = useMemo(() => Math.max(360, troubleTopData.length * 120), [troubleTopData.length])

  const shortLabel = useMemo(() => {
    return (value: unknown, max = 10) => {
      const s = String(value ?? '').trim()
      if (!s) return '-'
      if (s.length <= max) return s
      return `${s.slice(0, Math.max(1, max - 1))}…`
    }
  }, [])

  const pushFilters = (nextMonth: number, nextYear: number, nextDivision: DivisionFilter) => {
    const params = new URLSearchParams()
    params.set('month', String(nextMonth))
    params.set('year', String(nextYear))
    if (isAdmin && nextDivision !== 'ALL') {
      params.set('division', nextDivision)
    }
    router.replace(`/?${params.toString()}`)
    router.refresh()
  }

  const visibleDivisionSummary = useMemo(() => {
    if (focusedDivision === 'ALL') return divisionSummary
    return divisionSummary.filter((division) => division.code === focusedDivision)
  }, [divisionSummary, focusedDivision])

  const showSalesFocus = focusedDivision === 'ALL' || focusedDivision === 'PENJUALAN'
  const showTicketingFocus = focusedDivision === 'ALL' || focusedDivision === 'NOC_TROUBLESHOOTS'
  const showCreatorFocus = focusedDivision === 'CREATOR_DIGITAL'

  const dashboardContent = (
    <div className="space-y-6 pb-10">
      {/* Header & Filter */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {isMobilePortrait ? (
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold leading-tight tracking-tight text-ink">Dashboard</h1>
              <div className="min-w-0 text-right">
                <h2 className="text-lg font-medium leading-tight text-ink-muted">Operasional</h2>
                <p className="text-sm leading-tight text-ink-muted">Pantauan kerja harian</p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard Operasional</h1>
              <p className="mt-1 text-sm text-ink-muted">Ringkasan kerja harian lintas modul.</p>
            </>
          )}
        </div>

        <Card className="grid grid-cols-2 gap-2 p-2 md:flex md:items-center">
          <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
            <Calendar className="h-4 w-4 text-ink-muted" />
            <select
              value={month}
              onChange={(e) => {
                const newMonth = Number(e.target.value)
                pushFilters(newMonth, year, focusedDivision)
              }}
              className="w-full cursor-pointer rounded-md bg-transparent text-sm font-semibold text-ink focus:outline-none dark:[color-scheme:dark]"
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center rounded-lg bg-surface-muted px-3 py-2">
            <select
              value={year}
              onChange={(e) => {
                const newYear = Number(e.target.value)
                pushFilters(month, newYear, focusedDivision)
              }}
              className="w-full cursor-pointer rounded-md bg-transparent text-sm font-semibold text-ink focus:outline-none dark:[color-scheme:dark]"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div className="col-span-2 flex items-center rounded-lg bg-surface-muted px-3 py-2 md:col-span-1">
              <select
                value={focusedDivision}
                onChange={(e) => {
                  const newDivision = e.target.value as DivisionFilter
                  pushFilters(month, year, newDivision)
                }}
                className="w-full cursor-pointer rounded-md bg-transparent text-sm font-semibold text-ink focus:outline-none dark:[color-scheme:dark]"
              >
                <option value="ALL">Semua Divisi</option>
                <option value="PENJUALAN">Penjualan</option>
                <option value="CS_ADMIN">CS</option>
                <option value="NOC_TROUBLESHOOTS">NOC</option>
                <option value="CREATOR_DIGITAL">Creator Digital</option>
              </select>
            </div>
          )}
        </Card>
      </div>

      {visibleDivisionSummary.length > 0 && (
        <div className="space-y-3">
          <SectionHeading
            title="Performa Divisi"
            description={
              isAdmin && focusedDivision === 'ALL'
                ? 'Ringkasan per divisi dari data yang sudah aktif'
                : 'Ringkasan disesuaikan dengan divisi akun yang sedang aktif'
            }
          />
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {visibleDivisionSummary.map((division) => (
              <DivisionCard
                key={division.code}
                division={division}
                detailHref={
                  isAdmin
                    ? `/division-performance?division=${division.code}&mode=MONTHLY&month=${month}&year=${year}`
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {gaDailyActivityStats && (
        <div className="space-y-3">
          <SectionHeading
            title="Rekap Daily Activity"
            description="Aktivitas harian seluruh divisi pada periode aktif — untuk laporan manajemen"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total Aktivitas" value={gaDailyActivityStats.total} hint="Seluruh divisi" />
            <StatCard label="Selesai" value={gaDailyActivityStats.done} hint="Status DONE" />
            <StatCard label="Direncanakan" value={gaDailyActivityStats.planned} hint="Status PLANNED" />
            <StatCard label="Berjalan" value={gaDailyActivityStats.pending} hint="Status PENDING" />
            <StatCard label="Dibatalkan" value={gaDailyActivityStats.cancel} hint="Status CANCEL" />
            <StatCard label="Menunggu Approve" value={gaDailyActivityStats.pendingApproval} hint="Approval PENDING" />
          </div>

          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Aktivitas per Divisi</h3>
                <p className="text-sm text-ink-muted">Total vs selesai pada periode aktif</p>
              </div>
              <Link href="/daily-activity" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                Lihat detail →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Divisi</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink">Selesai</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink">Selesai %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {gaDailyActivityStats.byDivision.map((row) => {
                    const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0
                    return (
                      <tr key={row.division} className="transition-colors hover:bg-surface-muted">
                        <td className="px-4 py-3 text-sm font-medium text-ink">{row.division}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-ink">{row.total}</td>
                        <td className="px-4 py-3 text-center text-sm tabular-nums text-emerald-600 dark:text-emerald-400">{row.done}</td>
                        <td className="px-4 py-3 text-center text-sm tabular-nums text-ink-muted">{pct}%</td>
                      </tr>
                    )
                  })}
                  {gaDailyActivityStats.byDivision.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm italic text-ink-muted">
                        Belum ada data daily activity pada periode ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {focusedDivision !== 'ALL' && focusedDivisionKpis.length > 0 && (
        <div className="space-y-3">
          <SectionHeading title="KPI Divisi" description="KPI utama untuk periode bulanan yang sedang aktif." />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {focusedDivisionKpis.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
            ))}
          </div>
        </div>
      )}

      {showCreatorFocus && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Link href={`/content-calendar?division=CREATOR_DIGITAL`} className={cardClassName({ interactive: true, className: 'p-6' })}>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-ink">Calendar</h3>
              </div>
              <p className="text-sm text-ink-muted">Kelola jadwal dan konten marketing digital</p>
            </Link>
            <Link href={`/campaigns?division=CREATOR_DIGITAL`} className={cardClassName({ interactive: true, className: 'p-6' })}>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                  <Megaphone className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-ink">Campaign</h3>
              </div>
              <p className="text-sm text-ink-muted">Kelola campaign marketing digital</p>
            </Link>
            <Link href={`/digital-leads?division=CREATOR_DIGITAL`} className={cardClassName({ interactive: true, className: 'p-6' })}>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-ink">Digital Leads</h3>
              </div>
              <p className="text-sm text-ink-muted">Kelola leads dari channel digital</p>
            </Link>
            <Link href={`/analytics?division=CREATOR_DIGITAL`} className={cardClassName({ interactive: true, className: 'p-6' })}>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-ink">Analytics</h3>
              </div>
              <p className="text-sm text-ink-muted">Lihat performa konten dan campaign</p>
            </Link>
          </div>
        </div>
      )}

      {!showCreatorFocus && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(showSalesFocus || isCsRole) && (
            <ChartCard
              title={`Tren PSB ${year}`}
              description="Berdasarkan tanggal pasang"
              badge={<Chip tone="brand">{psbYearTotal} data</Chip>}
            >
              {psbYearSeries.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-muted italic">Belum ada data PSB untuk tahun ini</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={psbYearSeries} margin={{ top: 18, right: 16, left: 6, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                      <XAxis dataKey="label" tick={chartAxisTick} axisLine={false} tickLine={false} interval={0} />
                      <YAxis allowDecimals={false} tick={chartAxisTick} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Total"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#3b82f6' }}
                        activeDot={{ r: 6 }}
                      >
                        <LabelList dataKey="total" position="top" offset={8} fontSize={10} fontWeight={700} fill="#6b7280" />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          )}

          {!isMarketing && (showTicketingFocus || isCsRole) && (
            <ChartCard
              title={`Tren Trouble Ticket ${year}`}
              description="Jumlah tiket yang ditutup pada tiap bulan"
              badge={<Chip tone="warning">{troubleCloseYearTotal} tiket ditutup</Chip>}
            >
              {troubleCloseYearSeries.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-muted italic">Belum ada Trouble Ticket yang ditutup pada tahun ini</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={troubleCloseYearSeries} margin={{ top: 18, right: 16, left: 6, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                      <XAxis dataKey="label" tick={chartAxisTick} axisLine={false} tickLine={false} interval={0} />
                      <YAxis allowDecimals={false} tick={chartAxisTick} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Ditutup"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#f59e0b' }}
                        activeDot={{ r: 6 }}
                      >
                        <LabelList dataKey="total" position="top" offset={8} fontSize={10} fontWeight={700} fill="#6b7280" />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          )}
        </div>
      )}

      {isMobilePortrait && !showCreatorFocus && (
        <div className="space-y-4">
          {showSalesFocus && (
          <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-800 dark:text-white">Status PSB</h3>
                <p className="text-xs text-gray-500">Ringkasan status pada periode terpilih</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-100">
                Total: {statusCounts.total}
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData.length ? statusPieData : [{ name: 'EMPTY', value: 1, color: '#9ca3af' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(statusPieData.length ? statusPieData : [{ name: 'EMPTY', value: 1, color: '#9ca3af' }]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={(entry as { color: string }).color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [Number(value ?? 0), String(name ?? '')]}
                    contentStyle={{ borderRadius: '10px', border: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-red-50 dark:bg-red-950 px-3 py-2 text-center">
                <div className="text-[11px] font-semibold text-red-700 dark:text-red-200">OPEN</div>
                <div className="text-sm font-bold text-red-800 dark:text-red-100">{statusCounts.open}</div>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950 px-3 py-2 text-center">
                <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-200">ON PROGRESS</div>
                <div className="text-sm font-bold text-blue-800 dark:text-blue-100">{statusCounts.on_progress}</div>
              </div>
              <div className="rounded-xl bg-green-50 dark:bg-green-950 px-3 py-2 text-center">
                <div className="text-[11px] font-semibold text-green-700 dark:text-green-200">CLOSE</div>
                <div className="text-sm font-bold text-green-800 dark:text-green-100">{statusCounts.close}</div>
              </div>
            </div>
          </div>
          )}

          {showSalesFocus && (
          <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-800 dark:text-white">Paket Terlaris</h3>
                <p className="text-xs text-gray-500">Top paket pada periode terpilih</p>
              </div>
            </div>
            <div className="w-full overflow-x-auto -mx-4 px-4">
              <div style={{ width: packageChartWidth, height: 256 }}>
                <BarChart width={packageChartWidth} height={256} data={packageBarData.length ? packageBarData : [{ name: '-', count: 0 }]} margin={{ top: 12, right: 16, left: 10, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={64}
                    angle={-25}
                    textAnchor="end"
                    tickMargin={10}
                    tickFormatter={(v) => shortLabel(v, 12)}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none' }} cursor={{ fill: 'rgba(156, 163, 175, 0.08)' }} />
                  <Bar dataKey="count" name="Jumlah" radius={[8, 8, 0, 0]} barSize={28} fill="#3b82f6">
                    <LabelList dataKey="count" position="top" offset={6} fontSize={10} fontWeight={700} fill="#6b7280" />
                  </Bar>
                </BarChart>
              </div>
            </div>
          </div>
          )}

          {!isMarketing && showTicketingFocus && (
            <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-white">Ticketing</h3>
                  <p className="text-xs text-gray-500">Open vs Close per kategori bulan ini</p>
                </div>
              </div>
              <div className="w-full overflow-x-auto -mx-4 px-4">
                <div style={{ width: ticketingChartWidth, height: 256 }}>
                  <BarChart width={ticketingChartWidth} height={256} data={ticketingBarData.length ? ticketingBarData : [{ name: '-', open: 0, close: 0 }]} margin={{ top: 12, right: 16, left: 10, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      height={64}
                      angle={-25}
                      textAnchor="end"
                      tickMargin={10}
                      tickFormatter={(v) => shortLabel(v, 14)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none' }} cursor={{ fill: 'rgba(156, 163, 175, 0.08)' }} />
                    <Bar dataKey="open" name="Open" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={28} />
                    <Bar dataKey="close" name="Close" stackId="a" fill="#10b981" radius={[8, 8, 0, 0]} barSize={28} />
                  </BarChart>
                </div>
              </div>
            </div>
          )}

          {!isMarketing && showTicketingFocus && (
            <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-white">Top Gangguan TT</h3>
                  <p className="text-xs text-gray-500">Ringkasan 1 tahun (top 7)</p>
                </div>
              </div>
              <div className="w-full overflow-x-auto -mx-4 px-4">
                <div style={{ width: troubleChartWidth, height: 256 }}>
                  <BarChart width={troubleChartWidth} height={256} data={troubleTopData.length ? troubleTopData : [{ name: '-', total: 0 }]} margin={{ top: 12, right: 16, left: 10, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      height={72}
                      angle={-25}
                      textAnchor="end"
                      tickMargin={10}
                      tickFormatter={(v) => shortLabel(v, 12)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none' }} cursor={{ fill: 'rgba(156, 163, 175, 0.08)' }} />
                    <Bar dataKey="total" name="Total" radius={[8, 8, 0, 0]} barSize={28} fill="#f59e0b">
                      <LabelList dataKey="total" position="top" offset={6} fontSize={10} fontWeight={700} fill="#6b7280" />
                    </Bar>
                  </BarChart>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Marketing Table */}
      {!isMobilePortrait && !isTeknisi && !isNoc && (showSalesFocus || isCsRole) && !showCreatorFocus && (
      <Card className="p-5 sm:p-6">
        <SectionHeading
          title="Kinerja Marketing"
          description="Ringkasan progres per marketing"
          badge={<Chip tone="neutral">Target close</Chip>}
          className="mb-5"
        />

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 z-20 border-r border-line bg-surface px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted sm:static sm:border-r-0 sm:bg-transparent">Nama Marketing</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Progres</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Close</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">On Process</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Open</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink">Total</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Isolir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {marketingData.map((item, index) => {
                const target = 20
                const progress = (item.close / target) * 100

                return (
                  <tr key={index} className="transition-colors hover:bg-surface-muted">
                    <td className="sticky left-0 z-10 border-r border-line bg-surface px-4 py-2 whitespace-nowrap sm:static sm:border-r-0 sm:bg-transparent">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-ink">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <div className="mx-auto w-full max-w-[110px]">
                        <div className="mb-1 text-right text-[10px] leading-none tabular-nums text-ink-muted">
                          {Math.round(progress)}%
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-line">
                          {(() => {
                            const pct = Math.round(progress)
                            const colorClass = pct < 50 ? 'bg-rose-500' : pct < 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            return (
                              <div
                                className={`${colorClass} h-1 rounded-full`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            )
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <Chip tone="success">{item.close}</Chip>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <Chip tone="info">{item.on_progress}</Chip>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <Chip tone="danger">{item.open}</Chip>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <span className="text-sm font-bold leading-none tabular-nums text-ink">
                        {item.count}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => router.push(`/isolir?marketing=${encodeURIComponent(item.name)}&status=OPEN`)}
                        className="inline-flex items-center justify-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                        title={`Lihat isolir untuk ${item.name}`}
                      >
                        {item.isolir ?? 0}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {marketingData.length > 0 && (
                <tr className="border-t border-line bg-surface-muted font-bold">
                  <td className="sticky left-0 z-10 border-r border-line bg-surface-muted px-4 py-2 whitespace-nowrap text-ink sm:static sm:border-r-0">
                    TOTAL
                  </td>
                  <td className="px-4 py-2 text-center">
                    {/* Empty for progress column */}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap tabular-nums text-emerald-700 dark:text-emerald-400">
                    {totalClose}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap tabular-nums text-blue-700 dark:text-blue-400">
                    {totalOnProgress}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap tabular-nums text-rose-700 dark:text-rose-400">
                    {totalOpen}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap tabular-nums text-ink">
                    {totalCount}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap tabular-nums text-orange-700 dark:text-orange-400">
                    {totalIsolir}
                  </td>
                </tr>
              )}
              {marketingData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm italic text-ink-muted">
                    Tidak ada data marketing untuk periode ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {!isMobilePortrait && !isMarketing && showTicketingFocus && !showCreatorFocus && (
      <Card className="p-5 sm:p-6">
        <SectionHeading
          title={`Rekap Ticketing ${months[month - 1]} ${year}`}
          description="Ringkasan per kategori"
          badge={<Chip tone="neutral">Open vs close</Chip>}
          className="mb-5"
        />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="lg:w-72 lg:shrink-0">
            {ticketingPieData.length === 0 ? (
              <div className="flex h-60 items-center justify-center rounded-xl bg-surface-muted text-sm italic text-ink-muted">
                Tidak ada data
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-surface-muted p-4">
                <div className="mb-2 text-xs font-semibold text-ink-muted">Komposisi Open vs Close</div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ticketingPieData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={68} paddingAngle={4}>
                        {ticketingPieData.map((entry, index) => (
                          <Cell key={`cell-ticketing-${index}`} fill={(entry as { color: string }).color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [Number(value ?? 0), String(name ?? '')]}
                        contentStyle={chartTooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-rose-50 px-3 py-2 text-center dark:bg-rose-500/10">
                    <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">OPEN</div>
                    <div className="text-sm font-bold tabular-nums text-rose-800 dark:text-rose-200">{ticketingTotals.open}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center dark:bg-emerald-500/10">
                    <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">CLOSE</div>
                    <div className="text-sm font-bold tabular-nums text-emerald-800 dark:text-emerald-200">{ticketingTotals.close}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Kategori</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Open</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Close</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ticketingMonthRecap.map((r) => (
                  <tr key={r.type} className="transition-colors hover:bg-surface-muted">
                    <td className="px-4 py-3 text-sm font-medium text-ink">{r.type}</td>
                    <td className="px-4 py-3 text-center text-sm tabular-nums text-rose-700 dark:text-rose-300">{r.open}</td>
                    <td className="px-4 py-3 text-center text-sm tabular-nums text-emerald-700 dark:text-emerald-300">{r.close}</td>
                  </tr>
                ))}
                {ticketingMonthRecap.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm italic text-ink-muted">
                      Tidak ada data ticketing untuk bulan ini
                    </td>
                  </tr>
                )}
              </tbody>
              {ticketingMonthRecap.length > 0 && (
                <tfoot>
                  <tr className="border-t border-line bg-surface-muted">
                    <td className="px-4 py-3 text-sm font-semibold text-ink">Total</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                      {ticketingTotals.open}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {ticketingTotals.close}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Card>
      )}

      {!isMobilePortrait && !isMarketing && showTicketingFocus && !showCreatorFocus && (
      <Card className="p-5 sm:p-6">
        <SectionHeading
          title={`Gangguan Trouble Ticket ${year}`}
          description="Top gangguan berdasarkan total tahunan"
          badge={<Chip tone="warning">Top gangguan</Chip>}
          className="mb-5"
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 z-20 border-r border-line bg-surface px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted sm:static sm:border-r-0 sm:bg-transparent">Gangguan</th>
                {troubleVisibleMonthIdx.map((i) => (
                  <th key={troubleMonths[i]} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {troubleMonths[i]}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(troubleTicketProblemMonthly?.rows ?? []).map((r) => (
                <tr key={r.problemCategory} className="transition-colors hover:bg-surface-muted">
                  <td className="sticky left-0 z-10 border-r border-line bg-surface px-4 py-3 text-sm font-medium text-ink sm:static sm:border-r-0 sm:bg-transparent">{r.problemCategory}</td>
                  {troubleVisibleMonthIdx.map((i) => {
                    const v = Number(r.byMonth?.[i] ?? 0)
                    return (
                      <td key={i} className="px-3 py-3 text-center text-sm tabular-nums text-ink-muted">
                        {v}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-ink">
                    {r.total}
                  </td>
                </tr>
              ))}
              {(troubleTicketProblemMonthly?.rows?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-sm italic text-ink-muted">
                    Tidak ada data gangguan trouble ticket untuk tahun ini
                  </td>
                </tr>
              )}
            </tbody>
            {(troubleTicketProblemMonthly?.rows?.length ?? 0) > 0 && (
              <tfoot>
                <tr className="border-t border-line bg-surface-muted">
                  <td className="sticky left-0 z-10 border-r border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink sm:static sm:border-r-0">Total</td>
                  {troubleVisibleMonthIdx.map((i) => {
                    const v = (troubleTicketProblemMonthly?.rows ?? []).reduce((acc, r) => acc + Number(r.byMonth?.[i] ?? 0), 0)
                    return (
                      <td key={i} className="px-3 py-3 text-center text-sm font-semibold tabular-nums text-ink">
                        {v}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-ink">
                    {(troubleTicketProblemMonthly?.rows ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
      )}

      {/* Paket Terlaris Tahunan (sembunyikan untuk role MARKETING) */}
      {!isMobilePortrait && !isMarketing && !isTeknisi && showSalesFocus && !showCreatorFocus && (
        <ChartCard
          title={`Paket Terlaris (Tahun ${year})`}
          description="5 paket dengan pemasangan terbanyak"
          action={
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-muted text-ink-muted">
              <LayoutDashboard className="h-5 w-5" />
            </span>
          }
        >
          {yearTopPackageBarData.length === 0 ? (
            <div className="py-8 text-center text-sm italic text-ink-muted">
              Tidak ada data paket untuk tahun ini
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearTopPackageBarData} margin={{ top: 18, right: 16, left: 6, bottom: 14 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                  <XAxis
                    dataKey="name"
                    tick={chartAxisTick}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={56}
                    angle={0}
                    textAnchor="middle"
                    tickMargin={8}
                    tickFormatter={(v) => shortLabel(v, 14)}
                  />
                  <YAxis allowDecimals={false} tick={chartAxisTick} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} />
                  <Bar dataKey="count" name="Jumlah" barSize={34} radius={[10, 10, 0, 0]}>
                    {yearTopPackageBarData.map((_, index) => {
                      const palette = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444']
                      return <Cell key={`cell-year-top-${index}`} fill={palette[index % palette.length]} />
                    })}
                    <LabelList dataKey="count" position="top" offset={8} fontSize={10} fontWeight={700} fill="#6b7280" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      )}

      {/* Pelanggan per Marketing (Tahunan) - hanya non MARKETING */}
      {!isMobilePortrait && !isMarketing && !isTeknisi && !isNoc && showSalesFocus && !showCreatorFocus && (
        <Card className="p-5 sm:p-6">
          <SectionHeading
            title={`Pelanggan per Marketing (Tahun ${year})`}
            description="15 marketing dengan jumlah pelanggan terbanyak"
            action={
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-muted text-ink-muted">
                <User className="h-5 w-5" />
              </span>
            }
            className="mb-5"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="sticky left-0 z-20 border-r border-line bg-surface px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted sm:static sm:border-r-0 sm:bg-transparent">Marketing</th>
                  {marketingVisibleMonthIdx.map((i) => (
                    <th key={marketingMonths[i]} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {marketingMonths[i]}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(yearMarketingMonthly?.rows ?? []).map((r) => (
                  <tr key={r.name} className="transition-colors hover:bg-surface-muted">
                    <td className="sticky left-0 z-10 border-r border-line bg-surface px-4 py-3 text-sm font-medium text-ink sm:static sm:border-r-0 sm:bg-transparent">{r.name}</td>
                    {marketingVisibleMonthIdx.map((i) => {
                      const v = Number(r.byMonth?.[i] ?? 0)
                      return (
                        <td key={i} className="px-3 py-3 text-center text-sm tabular-nums text-ink-muted">
                          {v}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-ink">
                      {r.total}
                    </td>
                  </tr>
                ))}
                {(yearMarketingMonthly?.rows?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={14} className="px-4 py-10 text-center text-sm italic text-ink-muted">
                      Tidak ada data untuk tahun ini
                    </td>
                  </tr>
                )}
              </tbody>
              {(yearMarketingMonthly?.rows?.length ?? 0) > 0 && (
                <tfoot>
                  <tr className="border-t border-line bg-surface-muted">
                    <td className="sticky left-0 z-10 border-r border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink sm:static sm:border-r-0">Total</td>
                    {marketingVisibleMonthIdx.map((i) => {
                      const v = (yearMarketingMonthly?.rows ?? []).reduce((acc, r) => acc + Number(r.byMonth?.[i] ?? 0), 0)
                      return (
                        <td key={i} className="px-3 py-3 text-center text-sm font-semibold tabular-nums text-ink">
                          {v}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-ink">
                      {(yearMarketingMonthly?.rows ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </div>
  )

  const isHr = roleUpper === 'HR'
  const hrContent = hrStats ? (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard HR</h1>
          <p className="mt-1 text-sm text-ink-muted">Ringkasan data karyawan dan absensi.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Karyawan Aktif"
          value={hrStats.activeEmployees}
          hint="Total karyawan dengan status aktif"
        />
        <StatCard
          label="Terdaftar Fingerprint"
          value={hrStats.withFingerprint}
          hint="Karyawan aktif dengan ID mesin"
        />
        <StatCard
          label="Hadir Hari Ini"
          value={hrStats.presentToday}
          hint="Sudah absen masuk hari ini"
        />
        <StatCard
          label="Belum Absen"
          value={hrStats.absentToday}
          hint="Terdaftar namun belum absen"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Link href="/hr" className={cardClassName({ interactive: true, className: 'p-6' })}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink">Absensi HR</h3>
              <p className="text-sm text-ink-muted">Lihat rekap absensi karyawan per periode</p>
            </div>
          </div>
        </Link>
        <Link href="/hr?tab=employees" className={cardClassName({ interactive: true, className: 'p-6' })}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink">Data Karyawan</h3>
              <p className="text-sm text-ink-muted">Kelola data karyawan dan jabatan</p>
            </div>
          </div>
        </Link>
      </div>

      <Card className="p-5 sm:p-6">
        <SectionHeading
          title="Jumlah Karyawan per Divisi"
          description="Berdasarkan karyawan aktif"
          className="mb-5"
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Divisi</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {hrStats.departmentBreakdown.map((dept) => (
                <tr key={dept.department} className="transition-colors hover:bg-surface-muted">
                  <td className="px-4 py-3 text-sm font-medium text-ink">{dept.department}</td>
                  <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-ink">{dept.count}</td>
                </tr>
              ))}
              {hrStats.departmentBreakdown.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-sm italic text-ink-muted">
                    Belum ada data karyawan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  ) : null

  return (
    <>
      <MobileHome userName={userName ?? 'Pengguna'} userRole={userRole} statusCounts={statusCounts} />
      <div className="hidden md:block">{isHr && hrContent ? hrContent : dashboardContent}</div>
    </>
  )
}

function DivisionCard({ division, detailHref }: { division: DivisionSummary; detailHref?: string }) {
  const config = ({
    PENJUALAN: {
      Icon: Megaphone,
      iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
      badgeTone: 'brand',
      badgeLabel: 'Penjualan',
    },
    CS_ADMIN: {
      Icon: Headset,
      iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
      badgeTone: 'success',
      badgeLabel: 'CS',
    },
    NOC_TROUBLESHOOTS: {
      Icon: ShieldCheck,
      iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
      badgeTone: 'warning',
      badgeLabel: 'NOC',
    },
    CREATOR_DIGITAL: {
      Icon: Clapperboard,
      iconClass: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
      badgeTone: 'info',
      badgeLabel: 'Creator Digital',
    },
  } as const)[division.code]

  const statCards = division.extraStats?.length
    ? division.extraStats.map((item) => ({
        label: item.label,
        value: item.value,
        icon: undefined,
        tone: item.tone,
      }))
    : [
        {
          label: 'Member',
          value: division.members,
          icon: <Users className="h-4 w-4" />,
          tone: undefined,
        },
        {
          label: division.primaryLabel,
          value: division.primaryValue,
          tone: undefined,
        },
        {
          label: division.secondaryLabel,
          value: division.secondaryValue,
          tone: undefined,
        },
      ]

  const { Icon } = config

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', config.iconClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-semibold tracking-tight text-ink">{division.label}</h4>
            <p className="mt-1 text-sm text-ink-muted">{division.description}</p>
          </div>
        </div>
        <Chip tone={config.badgeTone}>{config.badgeLabel}</Chip>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {statCards.map((item) => (
          <div
            key={item.label}
            className={clsx(
              'rounded-xl border px-3 py-3',
              item.tone && 'text-center',
              item.tone === 'danger'
                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/70'
                : item.tone === 'info'
                  ? 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/70'
                  : item.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/70'
                    : 'border-line bg-surface-muted',
            )}
          >
            <div className={clsx(
              'flex items-center gap-2 text-xs font-semibold',
              item.tone ? 'justify-center' : 'uppercase tracking-wide',
              item.tone === 'danger'
                ? 'text-red-700 dark:text-red-300'
                : item.tone === 'info'
                  ? 'text-sky-700 dark:text-sky-300'
                  : item.tone === 'success'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-ink-muted',
            )}>
              {item.icon}
              {item.label}
            </div>
            <div className={clsx(
              'mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl',
              item.tone === 'danger'
                ? 'text-red-700 dark:text-red-300'
                : item.tone === 'info'
                  ? 'text-sky-700 dark:text-sky-300'
                  : item.tone === 'success'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-ink',
            )}>{item.value}</div>
          </div>
        ))}
      </div>

      {division.note && (
        <div className="mt-3 rounded-xl border border-line bg-surface-muted px-3 py-3 text-sm text-ink-muted">
          {division.note}
        </div>
      )}

      {detailHref && (
        <div className="mt-3 flex justify-end">
          <Link
            href={detailHref}
            className="inline-flex items-center rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
          >
            Lihat detail
          </Link>
        </div>
      )}
    </Card>
  )
}

