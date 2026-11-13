'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Gauge,
  Radio,
  RefreshCw,
  ShieldAlert,
  Wifi,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PROBE_STALE_AFTER_MS } from '@/lib/noc-dashboard'

const JalurMap = dynamic(() => import('@/components/JalurMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
      Memuat peta infrastruktur...
    </div>
  ),
})

type NocDashboardData = {
  generatedAt: string
  network: {
    platformTotal: number
    statusSummary: { up: number; warning: number; down: number; unknown: number }
    availabilityPercent: number | null
    avgLatencyMs: number | null
    lastCheckedAt: string | null
    platforms: Array<{
      id: string
      label: string
      url: string
      status: StatusTone
      latestCheckedAt: string | null
      latencyMs: number | null
      statusCode: number | null
    }>
    series: Array<{
      hour: string
      availabilityPercent: number | null
      latencyMs: number | null
    }>
  }
  incidents: {
    troubleActive: number
    preventiveActive: number
    totalActive: number
    latest: Array<{
      id: number
      ticketCode: string | null
      category: string
      type: string
      status: string
      problemCategory: string | null
      openedAt: string
    }>
  }
  telemetry: {
    traffic: { available: boolean; label: string }
    pppoe: { available: boolean; label: string }
  }
}

type StatusTone = 'UP' | 'WARNING' | 'DOWN' | 'UNKNOWN'

const statusLabel: Record<StatusTone, string> = {
  UP: 'Normal',
  WARNING: 'Periksa',
  DOWN: 'Down',
  UNKNOWN: 'Unknown',
}

function formatPercent(value: number | null) {
  if (value == null) return 'Belum ada data'
  return `${value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function formatLatency(value: number | null) {
  if (value == null) return 'Belum ada data'
  return `${Math.round(value).toLocaleString('id-ID')} ms`
}

function formatDateTime(value: string | null) {
  if (!value) return 'Belum ada pemeriksaan'
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatHour(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getOverallStatus(data: NocDashboardData | null) {
  if (!data || data.network.platformTotal === 0) return 'UNKNOWN'
  const { up, warning, down } = data.network.statusSummary
  if (down > 0) return 'DOWN'
  if (warning > 0 || data.network.statusSummary.unknown > 0) return 'WARNING'
  return up > 0 ? 'UP' : 'UNKNOWN'
}

function StatusPill({ status }: { status: StatusTone }) {
  const className = {
    UP: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
    WARNING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
    DOWN: 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300',
    UNKNOWN: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }[status]

  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${className}`}>{statusLabel[status]}</span>
}

function Panel({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
          {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Activity
  label: string
  value: string
  detail: string
  tone: 'blue' | 'green' | 'amber' | 'red' | 'cyan' | 'violet'
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  }

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 truncate text-lg font-extrabold tabular-nums text-slate-900 dark:text-white sm:text-xl">{value}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 truncate text-[10px] text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  )
}

function getTicketStatusTone(status: string): StatusTone {
  const normalized = status.trim().toUpperCase()
  if (normalized === 'OPEN') return 'DOWN'
  if (normalized === 'ON_PROGRESS' || normalized === 'IN_PROGRESS') return 'WARNING'
  return 'UNKNOWN'
}

export function NocDashboard() {
  const [data, setData] = useState<NocDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const refreshData = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setRefreshing(true)
    try {
      const response = await fetch('/api/noc-dashboard', {
        cache: 'no-store',
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat dashboard NOC')
      setData(payload as NocDashboardData)
      setError(null)
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat dashboard NOC')
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void refreshData()
    const timer = window.setInterval(() => void refreshData(), 60_000)
    return () => {
      window.clearInterval(timer)
      requestRef.current?.abort()
    }
  }, [refreshData])

  const overallStatus = getOverallStatus(data)
  const summary = data?.network.statusSummary
  const checkedAt = data?.network.lastCheckedAt ?? null
  const hasRecentProbe = checkedAt != null && Date.now() - new Date(checkedAt).getTime() <= PROBE_STALE_AFTER_MS
  const statusIcon = overallStatus === 'UP'
    ? <CheckCircle2 className="h-4 w-4" />
    : overallStatus === 'DOWN'
      ? <ShieldAlert className="h-4 w-4" />
      : <CircleHelp className="h-4 w-4" />

  return (
    <div className="space-y-4 pb-2">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-4 text-white shadow-lg sm:p-6">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200">
              <Radio className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Network Operations Center</p>
              <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Monitoring Jaringan</h1>
              <p className="mt-1 text-xs text-slate-300 sm:text-sm">Status layanan media sosial, performa probe, dan insiden operasional</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              overallStatus === 'UP'
                ? 'bg-emerald-400/15 text-emerald-200'
                : overallStatus === 'DOWN'
                  ? 'bg-red-400/15 text-red-200'
                  : 'bg-amber-300/15 text-amber-100'
            }`}>
              {statusIcon}
              {overallStatus === 'UP' ? 'Semua Layanan Normal' : overallStatus === 'DOWN' ? 'Ada Layanan Down' : 'Data Perlu Diperiksa'}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              hasRecentProbe ? 'bg-white/10 text-slate-100' : 'bg-amber-300/15 text-amber-100'
            }`}>
              <span className={`h-2 w-2 rounded-full ${hasRecentProbe ? 'animate-pulse bg-emerald-400' : 'bg-amber-300'}`} />
              {hasRecentProbe ? 'Probe segar' : 'Probe stale'}
            </span>
            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Pemeriksaan terakhir: {formatDateTime(checkedAt)}</span>
          <span>Data dashboard diperbarui: {data ? formatDateTime(data.generatedAt) : 'Memuat...'}</span>
          <span>Probe HTTP ke layanan media sosial</span>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      <section aria-label="Ringkasan jaringan" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={Gauge}
          label="Availability Probe"
          value={formatPercent(data?.network.availabilityPercent ?? null)}
          detail="Keberhasilan pemeriksaan 24 jam"
          tone="blue"
        />
        <KpiCard
          icon={Wifi}
          label="Platform Online"
          value={data ? `${summary?.up ?? 0}/${data.network.platformTotal}` : 'Memuat'}
          detail={data ? `${summary?.down ?? 0} down · ${summary?.unknown ?? 0} unknown` : 'Status target monitoring'}
          tone="green"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Insiden Aktif"
          value={data ? (data.incidents.totalActive).toLocaleString('id-ID') : 'Memuat'}
          detail={data ? `${data.incidents.troubleActive} trouble · ${data.incidents.preventiveActive} preventive` : 'Trouble Ticket belum dimuat'}
          tone={data && data.incidents.totalActive > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          icon={Activity}
          label="Latency Rata-rata"
          value={formatLatency(data?.network.avgLatencyMs ?? null)}
          detail="Sampel probe berhasil · 24 jam"
          tone="cyan"
        />
        <KpiCard
          icon={ArrowDownUp}
          label="Traffic Total"
          value="Belum tersedia"
          detail={data?.telemetry.traffic.label ?? 'Menunggu integrasi RouterOS'}
          tone="violet"
        />
        <KpiCard
          icon={Radio}
          label="Sesi PPPoE Aktif"
          value="Belum tersedia"
          detail={data?.telemetry.pppoe.label ?? 'Menunggu verifikasi RouterOS'}
          tone="amber"
        />
      </section>

      {loading && !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Memuat data monitoring NOC...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel
              title="Peta Infrastruktur"
              description="POP, ODC, ODP, splice, dan jalur jaringan"
              action={<Link href="/jalur" className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Buka peta</Link>}
              className="xl:col-span-7"
            >
              <JalurMap canEdit={false} compact />
            </Panel>

            <Panel
              title="Status Media Sosial"
              description="Status mengikuti dua pemeriksaan terakhir dan batas stale 15 menit"
              action={<span className="text-[10px] text-slate-500 dark:text-slate-400">{data?.network.platformTotal ?? 0} target</span>}
              className="xl:col-span-5"
            >
              <div className="mb-3 grid grid-cols-4 gap-1.5">
                {([
                  ['UP', summary?.up ?? 0],
                  ['WARNING', summary?.warning ?? 0],
                  ['DOWN', summary?.down ?? 0],
                  ['UNKNOWN', summary?.unknown ?? 0],
                ] as const).map(([status, count]) => (
                  <div key={status} className="rounded-xl bg-slate-50 px-2 py-2 text-center dark:bg-slate-800/70">
                    <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{count}</p>
                    <p className="text-[9px] font-semibold uppercase text-slate-500 dark:text-slate-400">{status}</p>
                  </div>
                ))}
              </div>
              <div className="max-h-[330px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {data?.network.platforms.map((platform) => (
                  <div key={platform.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <a
                        href={platform.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100"
                      >
                        {platform.label}
                      </a>
                      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        {platform.latestCheckedAt ? formatDateTime(platform.latestCheckedAt) : 'Belum pernah diperiksa'}
                        {platform.statusCode ? ` · HTTP ${platform.statusCode}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">{formatLatency(platform.latencyMs)}</span>
                      <StatusPill status={platform.status} />
                    </div>
                  </div>
                ))}
                {data?.network.platformTotal === 0 && (
                  <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Belum ada target media sosial yang dipantau.
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel
              title="Performa Probe"
              description="Availability probe media sosial per jam · 24 jam terakhir"
              className="xl:col-span-7"
            >
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.network.series ?? []} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" opacity={0.35} />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={formatHour}
                      minTickGap={32}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value: number) => `${value}%`}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      labelFormatter={(value) => formatDateTime(String(value))}
                      formatter={(value) => [value == null ? 'Belum ada data' : `${Number(value).toFixed(2)}%`, 'Availability']}
                      contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1', fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="availabilityPercent"
                      name="Availability"
                      stroke="#0ea5e9"
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Tidak ada garis SLA karena target SLA monitoring belum dikonfigurasi.
              </p>
            </Panel>

            <Panel
              title="Alarm & Insiden Terbaru"
              description="Trouble Ticket yang belum ditutup"
              action={<Link href="/trouble-ticket?division=NOC_TROUBLESHOOTS" className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Lihat semua</Link>}
              className="xl:col-span-5"
            >
              <div className="space-y-2">
                {data?.incidents.latest.map((incident) => (
                  <Link
                    key={incident.id}
                    href={`/trouble-ticket?focus=${encodeURIComponent(String(incident.id))}`}
                    className="block rounded-xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                        {incident.ticketCode || `TT-${incident.id}`}
                      </span>
                      <StatusPill status={getTicketStatusTone(incident.status)} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                        {incident.problemCategory || incident.type || 'Kategori belum diisi'}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                        {formatDateTime(incident.openedAt)}
                      </span>
                    </div>
                    <span className="mt-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {incident.category === 'PV' ? 'Preventive' : 'Trouble'}
                    </span>
                  </Link>
                ))}
                {data?.incidents.latest.length === 0 && (
                  <div className="flex min-h-36 flex-col items-center justify-center text-center">
                    <CheckCircle2 className="mb-2 h-7 w-7 text-emerald-500" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tidak ada insiden aktif</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Semua Trouble Ticket tercatat sudah ditutup.</p>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Tren Traffic Jaringan"
              description="Counter interface uplink RouterOS"
              className="min-h-[210px]"
            >
              <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 text-center dark:border-slate-700 dark:bg-slate-950/40">
                <ArrowDownUp className="mb-2 h-6 w-6 text-violet-500" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Telemetry RouterOS belum tersedia</p>
                <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                  Grafik inbound dan outbound akan muncul setelah versi API, perangkat, dan interface uplink dikonfirmasi.
                </p>
              </div>
            </Panel>
            <Panel
              title="Status Monitoring"
              description="Ringkasan kualitas dan kesegaran data"
              className="min-h-[210px]"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Availability 24 jam</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{formatPercent(data?.network.availabilityPercent ?? null)}</p>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Dari sampel probe media sosial tersimpan</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pemeriksaan Terakhir</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatDateTime(checkedAt)}</p>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Frekuensi job monitoring production belum diverifikasi</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30 sm:col-span-2">
                  <div className="flex items-start gap-2">
                    <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                    <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                      Status ini mengukur keterjangkauan HTTP ke layanan media sosial populer (Instagram, Facebook, TikTok, WhatsApp, YouTube, X), bukan availability POP atau packet loss ICMP. Traffic dan sesi PPPoE memerlukan sumber monitoring terpisah.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}

      <footer className="flex flex-col gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-200 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            {overallStatus === 'UP'
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              : overallStatus === 'DOWN'
                ? <ShieldAlert className="h-4 w-4 text-red-400" />
                : <CircleHelp className="h-4 w-4 text-amber-300" />}
            {overallStatus === 'UP' ? 'Monitoring layanan normal' : overallStatus === 'DOWN' ? 'Gangguan layanan terdeteksi' : 'Menunggu data probe'}
          </span>
          <span className="text-slate-400">Dipantau: {data?.network.platformTotal ?? 0} platform</span>
          <span className="text-slate-400">Online: {summary?.up ?? 0}</span>
          <span className="text-slate-400">Down: {summary?.down ?? 0}</span>
          <span className="text-slate-400">Latency: {formatLatency(data?.network.avgLatencyMs ?? null)}</span>
        </div>
        <span className="text-[10px] text-slate-400">Refresh otomatis tiap 1 menit</span>
      </footer>
    </div>
  )
}
