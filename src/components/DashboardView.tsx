'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { LayoutDashboard, Calendar, User, Megaphone, Headset, ShieldCheck, Clapperboard, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type DivisionSummary = {
  code: 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'
  label: string
  description: string
  members: number
  primaryValue: number
  primaryLabel: string
  secondaryValue: number
  secondaryLabel: string
  note?: string
}

type DivisionFilter = DivisionSummary['code'] | 'ALL'

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
  troubleTicketProblemMonthly?: {
    months: string[]
    rows: Array<{ problemCategory: string; total: number; byMonth: number[] }>
  }
  initialPeriod: { month: number; year: number }
  userRole?: string
  divisionSummary?: DivisionSummary[]
  selectedDivision?: DivisionFilter
}

export function DashboardView({ packageData, marketingData, monthlyData, yearTopPackages, yearMarketingMonthly, statusCounts, ticketingMonthRecap, troubleTicketProblemMonthly, initialPeriod, userRole, divisionSummary = [], selectedDivision = 'ALL' }: DashboardViewProps) {
  const router = useRouter()
  const [month, setMonth] = useState(initialPeriod.month)
  const [year, setYear] = useState(initialPeriod.year)
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)

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
  const isAdmin = userRole === 'ADMIN'
  const focusedDivision = isAdmin ? selectedDivision : 'ALL'

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

  const troubleYearTotalSeries = useMemo(() => {
    const months = (troubleTicketProblemMonthly?.months ?? defaultMonthShort).map((m) => String(m ?? '').trim() || '-')
    const rows = troubleTicketProblemMonthly?.rows ?? []
    const totals = months.map((label, i) => {
      const total = rows.reduce((acc, r) => acc + Number(r.byMonth?.[i] ?? 0), 0)
      return { label, total }
    })
    return totals.filter((x) => x.total > 0)
  }, [defaultMonthShort, troubleTicketProblemMonthly?.months, troubleTicketProblemMonthly?.rows])

  const troubleYearTotal = useMemo(() => troubleYearTotalSeries.reduce((acc, x) => acc + x.total, 0), [troubleYearTotalSeries])

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
    router.push(`/?${params.toString()}`)
  }

  const visibleDivisionSummary = useMemo(() => {
    if (!isAdmin || focusedDivision === 'ALL') return divisionSummary
    return divisionSummary.filter((division) => division.code === focusedDivision)
  }, [divisionSummary, focusedDivision, isAdmin])

  const showSalesFocus = !isAdmin || focusedDivision === 'ALL' || focusedDivision === 'PENJUALAN'
  const showSupportFocus =
    !isAdmin || focusedDivision === 'ALL' || focusedDivision === 'CS_ADMIN' || focusedDivision === 'NOC_TROUBLESHOOTS'
  const showTicketingFocus = !isAdmin || focusedDivision === 'ALL' || focusedDivision === 'NOC_TROUBLESHOOTS'
  const showNocFocus = !isAdmin || focusedDivision === 'ALL' || focusedDivision === 'NOC_TROUBLESHOOTS'
  const showCreatorPlaceholder = isAdmin && focusedDivision === 'CREATOR_DIGITAL'
  const focusDivisionConfig = {
    ALL: {
      title: 'Semua Divisi',
      description: 'Pantau kondisi operasional secara menyeluruh.',
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    },
    PENJUALAN: {
      title: 'Penjualan',
      description: 'PSB baru, aktivitas marketing, dan progres closing.',
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    },
    CS_ADMIN: {
      title: 'CS & Admin CS',
      description: 'Follow up pelanggan, isolir aktif, dan proses administratif.',
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    },
    NOC_TROUBLESHOOTS: {
      title: 'NOC & Troubleshoots',
      description: 'Aset jaringan, ODP, dan penyelesaian gangguan teknis.',
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    },
    CREATOR_DIGITAL: {
      title: 'Creator Digital',
      description: 'Slot divisi siap, KPI digital menyusul saat sumber data tersedia.',
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    },
  }[focusedDivision]

  return (
    <div className="space-y-6 pb-10">
      {/* Header & Filter */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-end md:justify-between md:space-y-0">
        <div>
          {isMobilePortrait ? (
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold leading-tight text-gray-800 dark:text-white">Dashboard</h1>
              <div className="min-w-0 text-right">
                <h2 className="text-lg font-medium leading-tight text-gray-500 dark:text-gray-400">Operasional</h2>
                <p className="text-sm leading-tight text-gray-400">Pantauan kerja harian</p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard Operasional</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ringkasan kerja harian lintas modul.</p>
            </>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800 md:flex md:items-center md:gap-2">
          <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              value={month}
              onChange={(e) => {
                const newMonth = Number(e.target.value)
                setMonth(newMonth)
                pushFilters(newMonth, year, focusedDivision)
              }}
              className="w-full bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
            <select
              value={year}
              onChange={(e) => {
                const newYear = Number(e.target.value)
                setYear(newYear)
                pushFilters(month, newYear, focusedDivision)
              }}
              className="w-full bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div className="col-span-2 flex items-center rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/40 md:col-span-1">
              <select
                value={focusedDivision}
                onChange={(e) => {
                  const newDivision = e.target.value as DivisionFilter
                  pushFilters(month, year, newDivision)
                }}
                className="w-full bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Divisi</option>
                <option value="PENJUALAN">Penjualan</option>
                <option value="CS_ADMIN">CS & Admin CS</option>
                <option value="NOC_TROUBLESHOOTS">NOC & Troubleshoots</option>
                <option value="CREATOR_DIGITAL">Creator Digital</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Fokus tampilan
                </span>
                <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-semibold', focusDivisionConfig.badge)}>
                  {focusDivisionConfig.title}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{focusDivisionConfig.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/30">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Penjualan</div>
                <div className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                  {focusedDivision === 'ALL' || focusedDivision === 'PENJUALAN' ? 'Tampil' : 'Disembunyikan'}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/30">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">CS & Admin</div>
                <div className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                  {focusedDivision === 'ALL' || focusedDivision === 'CS_ADMIN' ? 'Tampil' : 'Disembunyikan'}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/30">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Teknis</div>
                <div className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                  {focusedDivision === 'ALL' || focusedDivision === 'NOC_TROUBLESHOOTS' ? 'Tampil' : 'Disembunyikan'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && visibleDivisionSummary.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">Performa Divisi</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {focusedDivision === 'ALL'
                  ? 'Ringkasan per divisi dari data yang sudah aktif'
                  : 'Tampilan disesuaikan dengan divisi yang dipilih'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {visibleDivisionSummary.map((division) => (
              <DivisionCard
                key={division.code}
                division={division}
                detailHref={`/division?division=${division.code}&month=${month}&year=${year}`}
              />
            ))}
          </div>
        </div>
      )}

      {showCreatorPlaceholder && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
          Fokus `Creator Digital` sudah tersedia, tetapi KPI detailnya belum aktif karena sumber data campaign digital belum dibuat.
        </div>
      )}

      {!showCreatorPlaceholder && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {showSalesFocus && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Tren PSB {year}</h3>
                  <p className="text-xs text-gray-500">Berdasarkan tanggal pasang</p>
                </div>
                <div className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-100">
                  {psbYearTotal} data
                </div>
              </div>

              {psbYearSeries.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400 italic">Belum ada data PSB untuk tahun ini</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={psbYearSeries} margin={{ top: 18, right: 16, left: 6, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none' }} cursor={{ fill: 'rgba(156, 163, 175, 0.08)' }} />
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
            </div>
          )}

          {!isMarketing && showTicketingFocus && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Tren Trouble Ticket {year}</h3>
                  <p className="text-xs text-gray-500">Total per bulan yang terisi</p>
                </div>
                <div className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-100">
                  {troubleYearTotal} tiket
                </div>
              </div>

              {troubleYearTotalSeries.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400 italic">Belum ada data Trouble Ticket untuk tahun ini</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={troubleYearTotalSeries} margin={{ top: 18, right: 16, left: 6, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none' }} cursor={{ fill: 'rgba(156, 163, 175, 0.08)' }} />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Total"
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
            </div>
          )}
        </div>
      )}

      {isMobilePortrait && !showCreatorPlaceholder && (
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
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
                <div className="text-[11px] font-semibold text-red-700 dark:text-red-200">OPEN</div>
                <div className="text-sm font-bold text-red-800 dark:text-red-100">{statusCounts.open}</div>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-center">
                <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-200">ON PROGRESS</div>
                <div className="text-sm font-bold text-blue-800 dark:text-blue-100">{statusCounts.on_progress}</div>
              </div>
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 px-3 py-2 text-center">
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
      {!isMobilePortrait && !isTeknisi && !isNoc && showSalesFocus && !showCreatorPlaceholder && (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Kinerja Marketing</h3>
            <p className="text-xs text-gray-500">Ringkasan progres per marketing</p>
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-200">
            Target close
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="sticky left-0 z-20 border-r border-gray-100 bg-white px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:static sm:border-r-0 sm:bg-transparent">Nama Marketing</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Progres</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold text-green-500 dark:text-green-400 uppercase tracking-wider">Close</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">On Process</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">Open</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-800 dark:text-white uppercase tracking-wider">Total</th>
                <th className="px-4 py-2 text-center text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Isolir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {marketingData.map((item, index) => {
                const target = 20
                const progress = (item.close / target) * 100
                
                return (
                  <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-4 py-2 whitespace-nowrap dark:border-gray-700 dark:bg-gray-800 sm:static sm:border-r-0 sm:bg-transparent">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <div className="w-full max-w-[110px] mx-auto">
                        <div className="mb-1 text-right text-[10px] leading-none text-gray-500">
                          {Math.round(progress)}%
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                          {(() => {
                            const pct = Math.round(progress)
                            const colorClass = pct < 50 ? 'bg-red-500' : pct < 75 ? 'bg-amber-500' : 'bg-green-500'
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
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        {item.close}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                        {item.on_progress}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        {item.open}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-800 dark:text-white leading-none">
                        {item.count}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => router.push(`/isolir?marketing=${encodeURIComponent(item.name)}&status=OPEN`)}
                        className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 hover:underline"
                        title={`Lihat isolir untuk ${item.name}`}
                      >
                        {item.isolir ?? 0}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {marketingData.length > 0 && (
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold dark:border-gray-700 dark:bg-gray-900/30">
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-4 py-2 whitespace-nowrap text-gray-800 dark:border-gray-700 dark:bg-gray-900/30 dark:text-white sm:static sm:border-r-0">
                    TOTAL
                  </td>
                  <td className="px-4 py-2 text-center">
                    {/* Empty for progress column */}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap text-green-700 dark:text-green-400">
                    {totalClose}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap text-blue-700 dark:text-blue-400">
                    {totalOnProgress}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap text-red-700 dark:text-red-400">
                    {totalOpen}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap text-gray-900 dark:text-white">
                    {totalCount}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap text-orange-700 dark:text-orange-400">
                    {totalIsolir}
                  </td>
                </tr>
              )}
              {marketingData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400 italic">
                    Tidak ada data marketing untuk periode ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {!isMobilePortrait && !isMarketing && showTicketingFocus && !showCreatorPlaceholder && (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Rekap Ticketing {months[month - 1]} {year}</h3>
            <p className="text-xs text-gray-500">Ringkasan per kategori</p>
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-200">
            Open vs close
          </div>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="lg:w-72 lg:shrink-0">
            {ticketingPieData.length === 0 ? (
              <div className="h-60 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900/20 text-sm text-gray-500 dark:text-gray-400 italic">
                Tidak ada data
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/20">
                <div className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Komposisi Open vs Close</div>
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
                        contentStyle={{ borderRadius: '10px', border: 'none' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
                    <div className="text-[11px] font-semibold text-red-700 dark:text-red-200">OPEN</div>
                    <div className="text-sm font-bold text-red-800 dark:text-red-100">{ticketingTotals.open}</div>
                  </div>
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2 text-center">
                    <div className="text-[11px] font-semibold text-green-700 dark:text-green-200">CLOSE</div>
                    <div className="text-sm font-bold text-green-800 dark:text-green-100">{ticketingTotals.close}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">Open</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-green-500 dark:text-green-400 uppercase tracking-wider">Close</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {ticketingMonthRecap.map((r) => (
                  <tr key={r.type} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{r.type}</td>
                    <td className="px-4 py-3 text-center text-sm text-red-700 dark:text-red-300">{r.open}</td>
                    <td className="px-4 py-3 text-center text-sm text-green-700 dark:text-green-300">{r.close}</td>
                  </tr>
                ))}
                {ticketingMonthRecap.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400 italic">
                      Tidak ada data ticketing untuk bulan ini
                    </td>
                  </tr>
                )}
              </tbody>
              {ticketingMonthRecap.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Total</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-red-700 dark:text-red-300">
                      {ticketingTotals.open}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-green-700 dark:text-green-300">
                      {ticketingTotals.close}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
      )}

      {!isMobilePortrait && !isMarketing && showTicketingFocus && !showCreatorPlaceholder && (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Gangguan Trouble Ticket {year}</h3>
            <p className="text-xs text-gray-500">Top gangguan berdasarkan total tahunan</p>
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-200">
            Top gangguan
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="sticky left-0 z-20 border-r border-gray-100 bg-white px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:static sm:border-r-0 sm:bg-transparent">Gangguan</th>
                {troubleVisibleMonthIdx.map((i) => (
                  <th key={troubleMonths[i]} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {troubleMonths[i]}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-800 dark:text-white uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {(troubleTicketProblemMonthly?.rows ?? []).map((r) => (
                <tr key={r.problemCategory} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-4 py-3 text-sm font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 sm:static sm:border-r-0 sm:bg-transparent">{r.problemCategory}</td>
                  {troubleVisibleMonthIdx.map((i) => {
                    const v = Number(r.byMonth?.[i] ?? 0)
                    return (
                      <td key={i} className="px-3 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                        {v}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                    {r.total}
                  </td>
                </tr>
              ))}
              {(troubleTicketProblemMonthly?.rows?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-sm text-gray-400 italic">
                    Tidak ada data gangguan trouble ticket untuk tahun ini
                  </td>
                </tr>
              )}
            </tbody>
            {(troubleTicketProblemMonthly?.rows?.length ?? 0) > 0 && (
              <tfoot>
                <tr className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                  <td className="sticky left-0 z-10 border-r border-gray-100 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 sm:static sm:border-r-0">Total</td>
                  {troubleVisibleMonthIdx.map((i) => {
                    const v = (troubleTicketProblemMonthly?.rows ?? []).reduce((acc, r) => acc + Number(r.byMonth?.[i] ?? 0), 0)
                    return (
                      <td key={i} className="px-3 py-3 text-center text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {v}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                    {(troubleTicketProblemMonthly?.rows ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      )}

      {/* Paket Terlaris Tahunan (sembunyikan untuk role MARKETING) */}
      {!isMobilePortrait && !isMarketing && !isTeknisi && showSalesFocus && !showCreatorPlaceholder && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Paket Terlaris (Tahun {year})</h3>
              <p className="text-xs text-gray-500">5 paket dengan pemasangan terbanyak</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <LayoutDashboard className="h-5 w-5 text-gray-500 dark:text-gray-300" />
            </div>
          </div>
          {yearTopPackageBarData.length === 0 ? (
            <div className="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 italic">
              Tidak ada data paket untuk tahun ini
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearTopPackageBarData} margin={{ top: 18, right: 16, left: 6, bottom: 14 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={56}
                    angle={0}
                    textAnchor="middle"
                    tickMargin={8}
                    tickFormatter={(v) => shortLabel(v, 14)}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none' }} cursor={{ fill: 'rgba(156, 163, 175, 0.08)' }} />
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
        </div>
      )}

      {/* Pelanggan per Marketing (Tahunan) - hanya non MARKETING */}
      {!isMobilePortrait && !isMarketing && !isTeknisi && !isNoc && showSalesFocus && !showCreatorPlaceholder && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Pelanggan per Marketing (Tahun {year})</h3>
              <p className="text-xs text-gray-500">15 marketing dengan jumlah pelanggan terbanyak</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <User className="h-5 w-5 text-gray-500 dark:text-gray-300" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="sticky left-0 z-20 border-r border-gray-100 bg-white px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:static sm:border-r-0 sm:bg-transparent">Marketing</th>
                  {marketingVisibleMonthIdx.map((i) => (
                    <th key={marketingMonths[i]} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {marketingMonths[i]}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-800 dark:text-white uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {(yearMarketingMonthly?.rows ?? []).map((r) => (
                  <tr key={r.name} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-4 py-3 text-sm font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 sm:static sm:border-r-0 sm:bg-transparent">{r.name}</td>
                    {marketingVisibleMonthIdx.map((i) => {
                      const v = Number(r.byMonth?.[i] ?? 0)
                      return (
                        <td key={i} className="px-3 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                          {v}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                      {r.total}
                    </td>
                  </tr>
                ))}
                {(yearMarketingMonthly?.rows?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={14} className="px-4 py-10 text-center text-sm text-gray-400 italic">
                      Tidak ada data untuk tahun ini
                    </td>
                  </tr>
                )}
              </tbody>
              {(yearMarketingMonthly?.rows?.length ?? 0) > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                    <td className="sticky left-0 z-10 border-r border-gray-100 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 sm:static sm:border-r-0">Total</td>
                    {marketingVisibleMonthIdx.map((i) => {
                      const v = (yearMarketingMonthly?.rows ?? []).reduce((acc, r) => acc + Number(r.byMonth?.[i] ?? 0), 0)
                      return (
                        <td key={i} className="px-3 py-3 text-center text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {v}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                      {(yearMarketingMonthly?.rows ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

        </div>
      )}
    </div>
  )
}

function DivisionCard({ division, detailHref }: { division: DivisionSummary; detailHref: string }) {
  const config = {
    PENJUALAN: {
      icon: <Megaphone className="h-5 w-5 text-gray-700 dark:text-gray-200" />,
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    },
    CS_ADMIN: {
      icon: <Headset className="h-5 w-5 text-gray-700 dark:text-gray-200" />,
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    },
    NOC_TROUBLESHOOTS: {
      icon: <ShieldCheck className="h-5 w-5 text-gray-700 dark:text-gray-200" />,
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    },
    CREATOR_DIGITAL: {
      icon: <Clapperboard className="h-5 w-5 text-gray-700 dark:text-gray-200" />,
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    },
  }[division.code]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-700/30">{config.icon}</div>
          <div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">{division.label}</h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{division.description}</p>
          </div>
        </div>
        <div className={clsx('rounded-md px-2.5 py-1 text-[11px] font-semibold', config.badge)}>
          {division.code}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/30">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Users className="h-4 w-4" />
            Member
          </div>
          <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{division.members}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/30">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{division.primaryLabel}</div>
          <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{division.primaryValue}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/30">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{division.secondaryLabel}</div>
          <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{division.secondaryValue}</div>
        </div>
      </div>

      {division.note && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
          {division.note}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Link
          href={detailHref}
          className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          Lihat detail
        </Link>
      </div>
    </div>
  )
}

