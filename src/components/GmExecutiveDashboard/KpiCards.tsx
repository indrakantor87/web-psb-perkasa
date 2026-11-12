import type { GmDashboardData } from './useGmDashboard'

function fmtNum(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

function fmtPct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`
}

function DeltaBadge({ value, suffix = '%', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  if (!isFinite(value) || value === 0) return null
  const positive = invert ? value < 0 : value > 0
  const color = positive ? 'text-emerald-600' : 'text-red-600'
  const arrow = positive ? '↑' : '↓'
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  )
}

type KpiDef = {
  label: string
  value: string
  sub: string
  delta?: number
  deltaSuffix?: string
  deltaInvert?: boolean
  icon: string
  accent: string
}

export function KpiCards({ kpis, deltas }: { kpis: GmDashboardData['kpis']; deltas: GmDashboardData['deltas'] }) {
  const cards: KpiDef[] = [
    {
      label: 'Total Pelanggan',
      value: fmtNum(kpis.totalCustomers),
      sub: 'Seluruh RadBox',
      delta: deltas.customerGrowth,
      icon: '👥',
      accent: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Pelanggan Aktif',
      value: fmtNum(kpis.activeCustomers),
      sub: 'Tidak isolir',
      delta: deltas.activeGrowth,
      icon: '✅',
      accent: 'from-emerald-500 to-emerald-600',
    },
    {
      label: 'Penurunan Pelanggan',
      value: fmtPct(kpis.customerDeclinePercent),
      sub: 'Isolir total',
      deltaInvert: true,
      icon: '📉',
      accent: 'from-amber-500 to-orange-600',
    },
    {
      label: 'PSB Terpasang',
      value: fmtNum(kpis.psbInstalled),
      sub: 'YTD',
      delta: deltas.psbGrowth,
      icon: '🔌',
      accent: 'from-indigo-500 to-purple-600',
    },
    {
      label: 'Availability Jaringan',
      value: fmtPct(kpis.availabilityPercent, 2),
      sub: kpis.availabilityPercent > 0 ? 'Monitoring aktif' : 'Belum ada data',
      icon: '📡',
      accent: 'from-cyan-500 to-teal-600',
    },
    {
      label: 'TT Close Rate',
      value: fmtPct(kpis.ttCloseRate),
      sub: `MTTR ${kpis.mttrHours.toFixed(1)} jam`,
      icon: '🛠️',
      accent: 'from-rose-500 to-pink-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${c.accent} text-white text-base mb-2`}>
            {c.icon}
          </div>
          <div className="text-xs text-slate-500 font-medium">{c.label}</div>
          <div className="text-xl font-bold text-slate-800 mt-0.5">{c.value}</div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-slate-400">{c.sub}</span>
            {c.delta !== undefined && <DeltaBadge value={c.delta} suffix={c.deltaSuffix} invert={c.deltaInvert} />}
          </div>
        </div>
      ))}
    </div>
  )
}
