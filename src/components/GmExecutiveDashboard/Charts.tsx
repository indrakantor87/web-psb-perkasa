import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import { getFocusedIntegerAxisDomain } from '@/lib/chart-axis'
import { chartCursorFill, chartTooltipStyle } from '@/components/ui/chart'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

type SeriesPoint = GmDashboardData['dailySeries'][number]

export function CustomersIsolationBarChart({ data }: { data: SeriesPoint[] }) {
  const chartData = data.map((point) => ({
    ...point,
    isolationTotal: point.isolationContinued + point.isolationNotContinued,
  }))

  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-ink">Pelanggan & Isolir Harian</h3>
      <p className="mb-3 text-xs text-ink-muted">
        Perbandingan total pelanggan, pelanggan aktif, dan total data isolir per tanggal
      </p>
      {chartData.length === 0 ? (
        <div className="flex h-80 items-center justify-center text-sm text-ink-muted">
          Belum ada data laporan harian pada periode ini
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 10 }} barCategoryGap="18%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                stroke="var(--chart-axis)"
                interval="preserveStartEnd"
                angle={-35}
                textAnchor="end"
                height={58}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                stroke="var(--chart-axis)"
                domain={[0, 'auto']}
                width={48}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                cursor={chartCursorFill}
                labelStyle={{ color: 'var(--ink)' }}
                itemStyle={{ color: 'var(--ink)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ink)' }} />
              <Bar dataKey="totalCustomers" name="Pelanggan" fill="#facc15" maxBarSize={22}>
                <LabelList dataKey="totalCustomers" position="top" offset={4} fontSize={10} fontWeight={700} fill="var(--ink)" />
              </Bar>
              <Bar dataKey="activeCustomers" name="Pelanggan Aktif" fill="#84cc16" maxBarSize={22}>
                <LabelList dataKey="activeCustomers" position="top" offset={4} fontSize={10} fontWeight={700} fill="var(--ink)" />
              </Bar>
              <Bar dataKey="isolationTotal" name="Isolir" fill="#ef4444" maxBarSize={22}>
                <LabelList dataKey="isolationTotal" position="top" offset={4} fontSize={10} fontWeight={700} fill="var(--ink)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

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
  const focusedKey = lines.length === 1 && ['totalCustomers', 'activeCustomers'].includes(String(lines[0].key))
    ? lines[0].key
    : null
  const focusedDomain = focusedKey
    ? getFocusedIntegerAxisDomain(data.map((point) => Number(point[focusedKey] ?? 0)))
    : undefined
  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {empty ? (
        <div className="flex h-64 items-center justify-center text-sm text-ink-muted">Belum ada data laporan harian pada periode ini</div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" interval={Math.max(0, Math.floor(data.length / 8) - 1)} />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                stroke="var(--chart-axis)"
                width={50}
                allowDecimals={false}
                domain={focusedDomain}
              />
              <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-muted)' }} />
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
      title="Total Pelanggan Harian RadBoox 24, 25 & 26"
      data={data}
      lines={[{ key: 'totalCustomers', name: 'Total Pelanggan', color: '#ef4444' }]}
    />
  )
}

export function ActiveCustomersLineChart({ data }: { data: SeriesPoint[] }) {
  return (
    <DailyLineChart
      title="Pelanggan Aktif Harian RadBoox 24, 25 & 26"
      data={data}
      lines={[{ key: 'activeCustomers', name: 'Pelanggan Aktif', color: '#ef4444' }]}
    />
  )
}

export function IsolationLineChart({ data }: { data: SeriesPoint[] }) {
  return (
    <DailyLineChart
      title="Data Isolir Harian"
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
      title="Dismantle Harian"
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
    <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">Tren Pelanggan Harian</h3>
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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" />
            <YAxis tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" />
            <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-muted)' }} />
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
    <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">Pemasangan PSB per Hari</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" />
            <YAxis tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" allowDecimals={false} />
            <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} />
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
    <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">Gangguan per Kategori pada Periode</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" />
            <YAxis tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" allowDecimals={false} />
            <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-muted)' }} />
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
    <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">Distribusi Paket</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={{ color: 'var(--ink)' }}
              itemStyle={{ color: 'var(--ink)' }}
              formatter={(v: string | number | undefined) => `${v ?? 0} (${total > 0 ? ((Number(v) / total) * 100).toFixed(1) : 0}%)`}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-muted)' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function DivisionPerformance({
  divisions,
  periodLabel,
}: {
  divisions: GmDashboardData['divisions']
  periodLabel: string
}) {
  const fmtValue = (value: number, suffix?: string) =>
    `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}${suffix ?? ''}`

  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-ink">Ringkasan Kinerja Divisi · {periodLabel}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {divisions.map((d) => {
          const pct = Math.max(0, Math.min(100, d.progress))
          const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
          return (
            <div key={d.code} className="rounded-lg border border-line bg-surface-muted p-3">
              <div className="mb-1 text-xs font-semibold leading-tight text-ink-muted">{d.label}</div>
              <div className="text-lg font-bold text-ink">{fmtValue(d.primaryValue, d.valueSuffix)}</div>
              <div className="mb-2 text-[10px] text-ink-muted">{d.primaryLabel}</div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-ink-muted">{pct}% aktivitas</span>
                <span className="text-[10px] text-ink-muted">
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
