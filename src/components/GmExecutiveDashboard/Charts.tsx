import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { GmDashboardData } from './useGmDashboard'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

type SeriesPoint = GmDashboardData['dailySeries'][number]

function DailyLineChart({
  title,
  data,
  lines,
}: {
  title: string
  data: SeriesPoint[]
  lines: Array<{ key: keyof SeriesPoint; name: string; color: string }>
}) {
  const empty = data.length === 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      {empty ? (
        <div className="h-64 flex items-center justify-center text-sm text-slate-400">Belum ada data laporan harian</div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={Math.max(0, Math.floor(data.length / 8) - 1)} />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={50} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {lines.map((l) => (
                <Line
                  key={String(l.key)}
                  type="monotone"
                  dataKey={l.key as string}
                  name={l.name}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function TotalCustomersLineChart({ data }: { data: SeriesPoint[] }) {
  return (
    <DailyLineChart
      title="Total Pelanggan RadBoox 24, 25 & 26"
      data={data}
      lines={[{ key: 'totalCustomers', name: 'Total Pelanggan', color: '#ef4444' }]}
    />
  )
}

export function ActiveCustomersLineChart({ data }: { data: SeriesPoint[] }) {
  return (
    <DailyLineChart
      title="Total Pelanggan Aktif RadBoox 24, 25 & 26"
      data={data}
      lines={[{ key: 'activeCustomers', name: 'Pelanggan Aktif', color: '#ef4444' }]}
    />
  )
}

export function IsolationLineChart({ data }: { data: SeriesPoint[] }) {
  return (
    <DailyLineChart
      title="Data Isolir (30 Hari Terakhir)"
      data={data}
      lines={[
        { key: 'isolationContinued', name: 'Masih Dilanjutkan', color: '#3b82f6' },
        { key: 'isolationNotContinued', name: 'Tidak Dilanjutkan', color: '#f59e0b' },
      ]}
    />
  )
}

export function DismantleLineChart({ data }: { data: SeriesPoint[] }) {
  return (
    <DailyLineChart
      title="Dismantle (30 Hari Terakhir)"
      data={data}
      lines={[
        { key: 'dismantleOpen', name: 'Open', color: '#3b82f6' },
        { key: 'dismantleClosed', name: 'Close', color: '#f59e0b' },
      ]}
    />
  )
}

export function CustomerTrendChart({ data }: { data: GmDashboardData['customerTrend'] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Tren Pelanggan (YTD)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="totalCustomers" name="Total" stroke="#3b82f6" fill="url(#gradTotal)" strokeWidth={2} />
            <Area type="monotone" dataKey="activeCustomers" name="Aktif" stroke="#10b981" fill="url(#gradActive)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function PsbTrendChart({ data }: { data: GmDashboardData['psbTrend'] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Pemasangan PSB per Bulan</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="installed" name="Terpasang" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function TroubleTrendChart({ data }: { data: GmDashboardData['troubleTrend'] }) {
  const { months, rows } = data
  const chartData = months.map((m, i) => {
    const point: Record<string, string | number> = { month: m }
    for (const row of rows) {
      point[row.name] = row.byMonth[i] ?? 0
    }
    return point
  })
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Gangguan per Kategori (YTD)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {rows.map((row, i) => (
              <Bar key={row.name} dataKey={row.name} stackId="a" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function PackageDonut({ data }: { data: GmDashboardData['packageDistribution'] }) {
  const total = data.reduce((a, b) => a + b.count, 0)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribusi Paket</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: string | number | undefined) => `${v ?? 0} (${total > 0 ? ((Number(v) / total) * 100).toFixed(1) : 0}%)`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function DivisionPerformance({ divisions }: { divisions: GmDashboardData['divisions'] }) {
  const fmtValue = (value: number, suffix?: string) =>
    `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}${suffix ?? ''}`

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Ringkasan Kinerja Divisi</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {divisions.map((d) => {
          const pct = Math.max(0, Math.min(100, d.progress))
          const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
          return (
            <div key={d.code} className="rounded-lg border border-slate-100 p-3 bg-slate-50">
              <div className="text-xs font-semibold text-slate-600 mb-1 leading-tight">{d.label}</div>
              <div className="text-lg font-bold text-slate-800">{fmtValue(d.primaryValue, d.valueSuffix)}</div>
              <div className="text-[10px] text-slate-400 mb-2">{d.primaryLabel}</div>
              <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400">{pct}% aktivitas</span>
                <span className="text-[10px] text-slate-400">
                  {fmtValue(d.secondaryValue, d.secondarySuffix)} {d.secondaryLabel.toLowerCase()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
