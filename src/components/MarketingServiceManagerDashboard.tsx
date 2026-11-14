'use client'

import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  Headset,
  Megaphone,
  RefreshCw,
  Router,
  ShoppingCart,
  TrendingUp,
  Users,
  Wifi,
} from 'lucide-react'
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { canAccessMenu, getMenuHref } from '@/lib/access'
import { useGmDashboard } from '@/components/GmExecutiveDashboard/useGmDashboard'
import { Card } from '@/components/ui/Card'
import { chartAxisTick, chartCursorFill, chartTooltipStyle } from '@/components/ui/chart'

const numberFormat = new Intl.NumberFormat('id-ID')
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatNumber(value: number) {
  return numberFormat.format(Number(value || 0))
}

function percent(value: number) {
  return `${Math.max(0, Math.min(100, Number(value || 0))).toFixed(0)}%`
}

function MetricCard({
  title,
  icon: Icon,
  tone,
  mainLabel,
  mainValue,
  secondaryLabel,
  secondaryValue,
  progress,
  progressLabel,
  trendPercent,
  trendLabel,
  trendUp,
  trendGood,
}: {
  title: string
  icon: typeof ShoppingCart
  tone: 'blue' | 'green' | 'orange' | 'violet'
  mainLabel: string
  mainValue: string
  secondaryLabel: string
  secondaryValue: string
  progress: number
  progressLabel: string
  trendPercent: number
  trendLabel: string
  trendUp: boolean
  trendGood: boolean
}) {
  const tones = {
    blue: 'bg-blue-500 text-white',
    green: 'bg-emerald-500 text-white',
    orange: 'bg-orange-500 text-white',
    violet: 'bg-violet-500 text-white',
  }
  const bars = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    orange: 'bg-orange-500',
    violet: 'bg-violet-500',
  }

  return (
    <Card className="overflow-hidden p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-xs font-bold leading-tight text-ink sm:text-sm">{title}</h2>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-ink-muted">{mainLabel}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-ink sm:text-2xl">{mainValue}</p>
        </div>
        <div className="min-w-0 border-l border-line pl-3">
          <p className="truncate text-[11px] text-ink-muted">{secondaryLabel}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-ink sm:text-2xl">{secondaryValue}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {trendUp ? (
          <ArrowUpRight className={`h-3.5 w-3.5 ${trendGood ? 'text-emerald-500' : 'text-rose-500'}`} />
        ) : (
          <ArrowDownRight className={`h-3.5 w-3.5 ${trendGood ? 'text-emerald-500' : 'text-rose-500'}`} />
        )}
        <span className={`text-[11px] font-bold tabular-nums ${trendGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {Math.abs(trendPercent).toFixed(1).replace('.', ',')}%
        </span>
        <span className="text-[11px] text-ink-muted">{trendLabel}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full rounded-full transition-all ${bars[tone]}`} style={{ width: percent(progress) }} />
        </div>
        <span className="text-[10px] font-semibold tabular-nums text-ink-muted">{percent(progress)} {progressLabel}</span>
      </div>
    </Card>
  )
}

function DivisionCard({
  title,
  icon: Icon,
  tone,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  tertiaryLabel,
  tertiaryValue,
  subtext,
  chartData,
}: {
  title: string
  icon: typeof ShoppingCart
  tone: 'blue' | 'green' | 'orange' | 'violet'
  primaryLabel: string
  primaryValue: string
  secondaryLabel: string
  secondaryValue: string
  tertiaryLabel: string
  tertiaryValue: string
  subtext: string
  chartData: Array<{ label: string; value: number }>
}) {
  const tones = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  }
  const strokeColors = {
    blue: '#1684ff',
    green: '#16a765',
    orange: '#ff8a1f',
    violet: '#8157e8',
  }

  return (
    <Card className="p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="truncate text-sm font-bold text-ink">{title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          On Track
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] text-ink-muted">{primaryLabel}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-ink">{primaryValue}</p>
        </div>
        <div className="min-w-0 border-l border-line pl-2">
          <p className="truncate text-[10px] text-ink-muted">{secondaryLabel}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-ink">{secondaryValue}</p>
        </div>
        <div className="min-w-0 border-l border-line pl-2">
          <p className="truncate text-[10px] text-ink-muted">{tertiaryLabel}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-ink">{tertiaryValue}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-ink-muted">{subtext}</p>
      <div className="mt-2 h-16 min-w-0">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[10px] text-ink-muted">Belum ada data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${tone}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColors[tone]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={strokeColors[tone]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill={`url(#grad-${tone})`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={strokeColors[tone]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Tooltip
                contentStyle={{ ...chartTooltipStyle, fontSize: '11px' }}
                cursor={{ stroke: strokeColors[tone], strokeWidth: 1, strokeDasharray: '3 3' }}
                labelStyle={{ display: 'none' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

function statusTone(status: string) {
  const value = String(status || '').toUpperCase()
  if (value.includes('DONE') || value.includes('SELESAI') || value === 'CLOSE') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  if (value.includes('PENDING') || value.includes('PROGRESS') || value.includes('PROSES')) {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
  }
  if (value.includes('CANCEL')) return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
  return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
}

export function MarketingServiceManagerDashboard({
  userRole,
  userPosition,
  userSubdivision,
  userDivision,
}: {
  userRole: string
  userPosition?: string | null
  userSubdivision?: string | null
  userDivision?: string | null
}) {
  const {
    year,
    setYear,
    month,
    setMonth,
    trendDays,
    setTrendDays,
    data,
    loading,
    error,
    years,
    refresh,
  } = useGmDashboard()

  const ticketStatuses = data?.serviceMetrics.ticketStatuses
  const detailHref = (menu: Parameters<typeof getMenuHref>[0]) =>
    canAccessMenu(userRole, menu, userPosition, userSubdivision, userDivision)
      ? getMenuHref(menu)
      : '/daily-activity'
  const csTotal = ticketStatuses
    ? ticketStatuses.open + ticketStatuses.onProgress + ticketStatuses.close
    : 0
  const buildChartData = (key: 'sales' | 'psb' | 'trouble' | 'content') =>
    (data?.activityTrend ?? []).map((item) => ({ label: item.label, value: Number(item[key] || 0) }))
  const divisionCards = data
    ? [
        {
          title: 'Penjualan & Event',
          icon: Megaphone,
          tone: 'blue' as const,
          primaryLabel: 'PSB terpasang',
          primaryValue: formatNumber(data.kpis.psbInstalled),
          secondaryLabel: 'Pelanggan baru',
          secondaryValue: formatNumber(data.kpis.psbRequested),
          tertiaryLabel: 'Target',
          tertiaryValue: percent(data.kpis.psbRequested > 0 ? (data.kpis.psbInstalled / data.kpis.psbRequested) * 100 : 0),
          subtext: `Permohonan: ${formatNumber(data.kpis.psbRequested)} | Terpasang: ${formatNumber(data.kpis.psbInstalled)} | Antrian: ${formatNumber(data.kpis.installationQueue)}`,
          chartData: buildChartData('sales'),
        },
        {
          title: 'Customer Service',
          icon: Headset,
          tone: 'green' as const,
          primaryLabel: 'Total PSB',
          primaryValue: formatNumber(csTotal),
          secondaryLabel: 'Dismantle',
          secondaryValue: formatNumber(data.kpis.dismantleOpen),
          tertiaryLabel: 'Respons',
          tertiaryValue: percent(csTotal > 0 ? ((ticketStatuses?.close ?? 0) / csTotal) * 100 : 0),
          subtext: `Tiket masuk: ${formatNumber(csTotal)} | Ditangani: ${formatNumber(ticketStatuses?.close ?? 0)}`,
          chartData: buildChartData('psb'),
        },
        {
          title: 'NOC & Troubleshoot',
          icon: Wifi,
          tone: 'orange' as const,
          primaryLabel: 'Network Avail.',
          primaryValue: `${data.kpis.availabilityPercent.toFixed(1)}%`,
          secondaryLabel: 'Gangguan',
          secondaryValue: formatNumber(data.kpis.ttOpened),
          tertiaryLabel: 'Selesai',
          tertiaryValue: percent(data.kpis.ttCloseRate),
          subtext: `Tiket: ${formatNumber(data.kpis.ttOpened)} | Ditutup: ${formatNumber(data.kpis.ttClosed)} | Aktif: ${formatNumber(data.kpis.openTroubleTickets)}`,
          chartData: buildChartData('trouble'),
        },
        {
          title: 'Digital Creator',
          icon: Clapperboard,
          tone: 'violet' as const,
          primaryLabel: 'Konten Produksi',
          primaryValue: formatNumber(data.serviceMetrics.contentPublished + data.serviceMetrics.contentScheduled),
          secondaryLabel: 'Dipublikasi',
          secondaryValue: formatNumber(data.serviceMetrics.contentPublished),
          tertiaryLabel: 'Tepat Waktu',
          tertiaryValue: percent(
            data.serviceMetrics.contentPublished + data.serviceMetrics.contentScheduled > 0
              ? (data.serviceMetrics.contentPublished /
                  (data.serviceMetrics.contentPublished + data.serviceMetrics.contentScheduled)) * 100
              : 0
          ),
          subtext: `Terjadwal: ${formatNumber(data.serviceMetrics.contentScheduled)} | Leads: ${formatNumber(data.serviceMetrics.digitalLeads)}`,
          chartData: buildChartData('content'),
        },
      ]
    : []

  return (
    <div className="space-y-4 pb-8 sm:space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-sky-100 p-5 shadow-sm dark:border-blue-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full border-[36px] border-white/40 dark:border-white/5" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Perkasa Networks</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Dashboard Manager
              <span className="block text-blue-800 dark:text-blue-300">Pemasaran &amp; Pelayanan</span>
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Monitoring penjualan, pelanggan, layanan, dan produksi digital</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/85 px-3 py-2 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              <select
                aria-label="Pilih bulan dashboard"
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className="bg-transparent text-sm font-semibold focus:outline-none dark:[color-scheme:dark]"
              >
                {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
            </label>
            <select
              aria-label="Pilih tahun dashboard"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="rounded-lg border border-white/80 bg-white/85 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
            >
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-lg border border-white/80 bg-white/85 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
        {data && (
          <p className="relative mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            Periode {data.periodLabel} · Diperbarui {new Date(data.generatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB
          </p>
        )}
      </section>

      {loading && !data && (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-ink-muted">Memuat dashboard...</div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          Dashboard gagal dimuat: {error}
        </div>
      )}

      {data && (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              title="Penjualan & Pelanggan Baru"
              icon={ShoppingCart}
              tone="blue"
              mainLabel="PSB terpasang"
              mainValue={formatNumber(data.kpis.psbInstalled)}
              secondaryLabel="Pelanggan Baru"
              secondaryValue={formatNumber(data.kpis.psbRequested)}
              progress={data.kpis.psbRequested > 0 ? (data.kpis.psbInstalled / data.kpis.psbRequested) * 100 : 0}
              progressLabel="dari target"
              trendPercent={data.kpis.psbRequested > 0 ? (data.kpis.psbInstalled / data.kpis.psbRequested) * 100 : 0}
              trendLabel="dari target"
              trendUp={true}
              trendGood={true}
            />
            <MetricCard
              title="PSB & Dismantle"
              icon={Router}
              tone="green"
              mainLabel="Total PSB"
              mainValue={`${formatNumber(data.kpis.psbInstalled)} / ${formatNumber(data.kpis.psbRequested)}`}
              secondaryLabel="Dismantle"
              secondaryValue={formatNumber(data.kpis.dismantleOpen)}
              progress={data.kpis.psbRequested > 0 ? (data.kpis.psbInstalled / data.kpis.psbRequested) * 100 : 0}
              progressLabel="dari target"
              trendPercent={data.kpis.psbRequested > 0 ? (data.kpis.psbInstalled / data.kpis.psbRequested) * 100 : 0}
              trendLabel="dari target"
              trendUp={true}
              trendGood={true}
            />
            <MetricCard
              title="Gangguan & Troubleshoot"
              icon={AlertTriangle}
              tone="orange"
              mainLabel="Gangguan"
              mainValue={`${formatNumber(data.kpis.openTroubleTickets)} / ${formatNumber(data.kpis.ttOpened)}`}
              secondaryLabel="Aktif"
              secondaryValue={formatNumber(data.kpis.openTroubleTickets)}
              progress={data.kpis.ttCloseRate}
              progressLabel="terselesaikan"
              trendPercent={data.kpis.ttCloseRate}
              trendLabel="terselesaikan"
              trendUp={true}
              trendGood={true}
            />
            <MetricCard
              title="Produksi Digital"
              icon={Clapperboard}
              tone="violet"
              mainLabel="Konten"
              mainValue={`${formatNumber(data.serviceMetrics.contentPublished)} / ${formatNumber(data.serviceMetrics.contentPublished + data.serviceMetrics.contentScheduled)}`}
              secondaryLabel="Posting"
              secondaryValue={formatNumber(data.serviceMetrics.contentScheduled)}
              progress={
                data.serviceMetrics.contentPublished + data.serviceMetrics.contentScheduled > 0
                  ? (data.serviceMetrics.contentPublished /
                      (data.serviceMetrics.contentPublished + data.serviceMetrics.contentScheduled)) * 100
                  : 0
              }
              progressLabel="dari target"
              trendPercent={
                data.serviceMetrics.contentPublished + data.serviceMetrics.contentScheduled > 0
                  ? (data.serviceMetrics.contentPublished /
                      (data.serviceMetrics.contentPublished + data.serviceMetrics.contentScheduled)) * 100
                  : 0
              }
              trendLabel="dari target"
              trendUp={true}
              trendGood={true}
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-muted/60 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-base font-bold text-ink">Performa Empat Divisi</h2>
                <p className="text-xs text-ink-muted">Ringkasan hasil periode {data.periodLabel}</p>
              </div>
              <Link href="/daily-activity" className="shrink-0 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Lihat Detail <ArrowUpRight className="inline h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4 sm:p-4">
              {divisionCards.map((item) => <DivisionCard key={item.title} {...item} />)}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="p-4 shadow-sm sm:p-5 xl:col-span-7">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Tren Aktivitas
                  </h2>
                  <p className="text-xs text-ink-muted">Permohonan, pemasangan PSB, gangguan, dan konten tayang</p>
                </div>
                <div className="flex rounded-lg bg-surface-muted p-1">
                  {[7, 30, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={trendDays === days}
                      onClick={() => setTrendDays(days)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        trendDays === days
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {days} Hari
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-60 min-w-0 sm:h-72">
                {data.activityTrend.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-ink-muted">Belum ada data tren.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.activityTrend} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" tick={chartAxisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
                      <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} />
                      <Line type="monotone" dataKey="sales" name="Permohonan" stroke="#1684ff" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="psb" name="PSB terpasang" stroke="#16a765" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="trouble" name="Gangguan" stroke="#ff8a1f" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="content" name="Konten" stroke="#8157e8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />Permohonan</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />PSB</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" />Gangguan</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" />Konten</span>
              </div>
            </Card>

            <Card className="p-4 shadow-sm sm:p-5 xl:col-span-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                    <AlertTriangle className="h-4 w-4 text-orange-500" /> Monitoring Kendala
                  </h2>
                  <p className="text-xs text-ink-muted">Risiko dan pekerjaan yang perlu dipantau</p>
                </div>
                <Link href={detailHref('trouble-ticket')} className="shrink-0 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                  Lihat Semua <ArrowUpRight className="inline h-3 w-3" />
                </Link>
              </div>
              {data.risks.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-xl bg-surface-muted px-4 text-center">
                  <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-semibold text-ink">Tidak ada kendala aktif</p>
                  <p className="mt-1 text-xs text-ink-muted">Belum ada blocker pada data periode ini.</p>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {data.risks.slice(0, 6).map((risk, index) => (
                    <div key={`${risk.category}-${index}`} className="flex items-start gap-2.5 py-3 first:pt-1 last:pb-1">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${index < 2 ? 'bg-orange-500' : 'bg-blue-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold leading-snug text-ink">{risk.category}</p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-ink-muted">{risk.detail}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                        index < 2
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                      }`}>
                        {formatNumber(risk.count)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="overflow-hidden shadow-sm xl:col-span-7">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <div>
                  <h2 className="text-sm font-bold text-ink">Aktivitas Terbaru</h2>
                  <p className="text-xs text-ink-muted">Pembaruan Daily Activity Pemasaran dan Pelayanan</p>
                </div>
                <Link href="/daily-activity" className="shrink-0 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                  Lihat Semua <ArrowUpRight className="inline h-3 w-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead className="bg-surface-muted/50">
                    <tr className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2.5">Waktu</th>
                      <th className="px-4 py-2.5">Divisi</th>
                      <th className="px-4 py-2.5">Aktivitas</th>
                      <th className="px-4 py-2.5">Petugas</th>
                      <th className="px-4 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.recentActivities.map((item) => (
                      <tr key={item.id} className="text-xs hover:bg-surface-muted/60">
                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                          {new Date(item.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{item.subdivision}</td>
                        <td className="max-w-64 truncate px-4 py-3 text-ink">{item.title}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{item.owner}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(item.status)}`}>
                            {item.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.recentActivities.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted">Belum ada aktivitas pada periode ini.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4 shadow-sm sm:p-5 xl:col-span-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <span className="text-amber-500">★</span> Ringkasan Eksekutif
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-surface-muted p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Kinerja Layanan</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[6px] border-emerald-500 text-sm font-extrabold text-ink">
                      {data.kpis.availabilityPercent.toFixed(0)}%
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">Availability jaringan</p>
                      <p className="mt-1 text-xs text-ink-muted">{data.kpis.ttCloseRate.toFixed(0)}% gangguan selesai</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-surface-muted p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Perlu Tindak Lanjut</p>
                  {data.risks.length ? (
                    <ul className="mt-2 space-y-2">
                      {data.risks.slice(0, 2).map((risk, index) => (
                        <li key={`${risk.category}-${index}`} className="flex gap-2 text-xs text-ink">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                          <span className="line-clamp-2">{risk.category} ({formatNumber(risk.count)})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> Tidak ada kendala utama
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">{data.execSummary}</p>
            </Card>
          </section>

          {/* Tren Tahunan: PSB & Trouble Ticket */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                    <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Tren PSB {year}
                  </h2>
                  <p className="text-xs text-ink-muted">Berdasarkan tanggal pasang</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  {formatNumber(data.yearlyPsbTotal ?? 0)} data
                </span>
              </div>
              <div className="h-56 min-w-0 sm:h-64">
                {(data.yearlyPsbTrend?.length ?? 0) === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-ink-muted">Belum ada data PSB tahun {year}.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.yearlyPsbTrend} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" tick={chartAxisTick} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
                      <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} />
                      <Line type="monotone" dataKey="count" name="PSB terpasang" stroke="#1684ff" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                    <AlertTriangle className="h-4 w-4 text-orange-500" /> Tren Trouble Ticket {year}
                  </h2>
                  <p className="text-xs text-ink-muted">Jumlah tiket yang ditutup pada tiap bulan</p>
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                  {formatNumber(data.yearlyTroubleClosedTotal ?? 0)} tiket ditutup
                </span>
              </div>
              <div className="h-56 min-w-0 sm:h-64">
                {(data.yearlyTroubleClosedTrend?.length ?? 0) === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-ink-muted">Belum ada data Trouble Ticket tahun {year}.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.yearlyTroubleClosedTrend} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" tick={chartAxisTick} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
                      <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} />
                      <Line type="monotone" dataKey="count" name="Tiket ditutup" stroke="#ff8a1f" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </section>

          {/* Kinerja Marketing */}
          <Card className="overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-sm font-bold text-ink">Kinerja Marketing</h2>
                <p className="text-xs text-ink-muted">Ringkasan progres per marketing periode {data.periodLabel}</p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-muted">Target close</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-surface-muted/50">
                  <tr className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2.5">Nama Marketing</th>
                    <th className="px-4 py-2.5">Progres</th>
                    <th className="px-4 py-2.5 text-center">Close</th>
                    <th className="px-4 py-2.5 text-center">On Process</th>
                    <th className="px-4 py-2.5 text-center">Open</th>
                    <th className="px-4 py-2.5 text-center">Total</th>
                    <th className="px-4 py-2.5 text-center">Isolir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data.marketingPerformance ?? []).map((row) => {
                    const progress = row.count > 0 ? (row.close / row.count) * 100 : 0
                    const barColor = progress >= 75 ? 'bg-emerald-500' : progress >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    return (
                      <tr key={row.name} className="text-xs hover:bg-surface-muted/60">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{row.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted sm:w-32">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, progress)}%` }} />
                            </div>
                            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink-muted">{progress.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex min-w-[2rem] justify-center rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{row.close}</span></td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex min-w-[2rem] justify-center rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{row.on_progress}</span></td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex min-w-[2rem] justify-center rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{row.open}</span></td>
                        <td className="px-4 py-3 text-center font-bold tabular-nums text-ink">{row.count}</td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex min-w-[2rem] justify-center rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{row.isolir}</span></td>
                      </tr>
                    )
                  })}
                  {(data.marketingPerformance ?? []).length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-muted">Belum ada data marketing pada periode ini.</td></tr>
                  )}
                </tbody>
                {(data.marketingPerformance ?? []).length > 0 && (
                  <tfoot className="bg-surface-muted/60 font-bold text-ink">
                    <tr className="text-xs">
                      <td className="px-4 py-3">TOTAL</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400">{(data.marketingPerformance ?? []).reduce((s, r) => s + r.close, 0)}</td>
                      <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">{(data.marketingPerformance ?? []).reduce((s, r) => s + r.on_progress, 0)}</td>
                      <td className="px-4 py-3 text-center text-rose-600 dark:text-rose-400">{(data.marketingPerformance ?? []).reduce((s, r) => s + r.open, 0)}</td>
                      <td className="px-4 py-3 text-center">{(data.marketingPerformance ?? []).reduce((s, r) => s + r.count, 0)}</td>
                      <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">{(data.marketingPerformance ?? []).reduce((s, r) => s + r.isolir, 0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          {/* Gangguan Trouble Ticket Tahunan */}
          <Card className="overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-sm font-bold text-ink">Gangguan Trouble Ticket {year}</h2>
                <p className="text-xs text-ink-muted">Top gangguan berdasarkan total tahunan</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Top gangguan</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-surface-muted/50">
                  <tr className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2.5">Gangguan</th>
                    {(data.yearlyTroubleByCategoryMonths ?? []).map((m) => (
                      <th key={m} className="px-3 py-2.5 text-center">{m}</th>
                    ))}
                    <th className="px-4 py-2.5 text-center">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data.yearlyTroubleByCategory ?? []).map((row) => (
                    <tr key={row.name} className="text-xs hover:bg-surface-muted/60">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{row.name}</td>
                      {row.byMonth.map((val, i) => (
                        <td key={i} className="px-3 py-3 text-center tabular-nums text-ink-muted">{val}</td>
                      ))}
                      <td className="px-4 py-3 text-center font-bold tabular-nums text-ink">{row.total}</td>
                    </tr>
                  ))}
                  {(data.yearlyTroubleByCategory ?? []).length === 0 && (
                    <tr>
                      <td colSpan={(data.yearlyTroubleByCategoryMonths?.length ?? 0) + 2} className="px-4 py-10 text-center text-sm text-ink-muted">
                        Belum ada data gangguan tahun {year}.
                      </td>
                    </tr>
                  )}
                </tbody>
                {(data.yearlyTroubleByCategory ?? []).length > 0 && (
                  <tfoot className="bg-surface-muted/60 font-bold text-ink">
                    <tr className="text-xs">
                      <td className="px-4 py-3">Total</td>
                      {(data.yearlyTroubleByCategoryMonths ?? []).map((_, i) => (
                        <td key={i} className="px-3 py-3 text-center tabular-nums">
                          {(data.yearlyTroubleByCategory ?? []).reduce((s, r) => s + (r.byMonth[i] || 0), 0)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center tabular-nums">
                        {(data.yearlyTroubleByCategory ?? []).reduce((s, r) => s + r.total, 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          {/* Pelanggan per Marketing Tahunan */}
          <Card className="overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Pelanggan per Marketing (Tahun {year})
                </h2>
                <p className="text-xs text-ink-muted">15 marketing dengan jumlah pelanggan terbanyak</p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-surface-muted/50">
                  <tr className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2.5">Marketing</th>
                    {(data.yearlyCustomersByMarketingMonths ?? []).map((m) => (
                      <th key={m} className="px-3 py-2.5 text-center">{m}</th>
                    ))}
                    <th className="px-4 py-2.5 text-center">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data.yearlyCustomersByMarketing ?? []).map((row) => (
                    <tr key={row.name} className="text-xs hover:bg-surface-muted/60">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{row.name}</td>
                      {row.byMonth.map((val, i) => (
                        <td key={i} className="px-3 py-3 text-center tabular-nums text-ink-muted">{val}</td>
                      ))}
                      <td className="px-4 py-3 text-center font-bold tabular-nums text-ink">{row.total}</td>
                    </tr>
                  ))}
                  {(data.yearlyCustomersByMarketing ?? []).length === 0 && (
                    <tr>
                      <td colSpan={(data.yearlyCustomersByMarketingMonths?.length ?? 0) + 2} className="px-4 py-10 text-center text-sm text-ink-muted">
                        Belum ada data pelanggan per marketing tahun {year}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
