'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { clsx } from 'clsx'
import { LayoutDashboard, Ticket, Calendar, TrendingUp, WifiOff, Wifi, Wrench, User } from 'lucide-react'


interface DashboardViewProps {
  packageData: { name: string; count: number }[]
  marketingData: { name: string; count: number; open: number; on_progress: number; close: number; isolir?: number }[]
  monthlyData: { name: string; count: number }[]
  yearTopPackages: { name: string; count: number }[]
  yearMarketingCounts: { name: string; count: number }[]
  statusCounts: { total: number; open: number; close: number; on_progress: number }
  marketingActivityTotal: number
  odpTotal: number
  ticketingTotal: number
  ticketingYearRecap: Array<{ type: string; total: number; open: number; close: number }>
  initialPeriod: { month: number; year: number }
  userRole?: string
  isolationCount?: number
}

export function DashboardView({ marketingData, monthlyData, yearTopPackages, yearMarketingCounts, statusCounts, marketingActivityTotal, odpTotal, ticketingTotal, ticketingYearRecap, initialPeriod, userRole, isolationCount = 0 }: DashboardViewProps) {
  const router = useRouter()
  const [month, setMonth] = useState(initialPeriod.month)
  const [year, setYear] = useState(initialPeriod.year)
  const isMarketing = userRole === 'MARKETING'
  const isTeknisi = userRole === 'TEKNISI'

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

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Filter */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Ringkasan</h2>
          <p className="text-sm text-gray-400">Pantau kinerja dan status tiket</p>
        </div>
        
        <div className="flex flex-col space-y-2 rounded-xl bg-white dark:bg-gray-800 p-2 shadow-sm border border-gray-100 dark:border-gray-700 md:flex-row md:items-center md:space-y-0 md:space-x-2">
          <div className="flex items-center px-2 space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              value={month}
              onChange={(e) => {
                const newMonth = Number(e.target.value)
                setMonth(newMonth)
                router.push(`/?month=${newMonth}&year=${year}`)
              }}
              className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-600 hidden md:block"></div>
          <div className="flex items-center px-2">
            <select
              value={year}
              onChange={(e) => {
                const newYear = Number(e.target.value)
                setYear(newYear)
                router.push(`/?month=${month}&year=${newYear}`)
              }}
              className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div
        className={clsx(
          'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3',
          isTeknisi ? 'xl:grid-cols-3' : 'xl:grid-cols-5'
        )}
      >
        <StatCard 
          title="Total PSB" 
          value={statusCounts.total} 
          icon={<Ticket className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
          trend="Total"
          color="bg-blue-50 dark:bg-blue-900/20"
        />
        {!isTeknisi && (
          <StatCard 
            title="Total Aktivitas Marketing" 
            value={marketingActivityTotal} 
            icon={<TrendingUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
            trend="Total"
            color="bg-indigo-50 dark:bg-indigo-900/20"
          />
        )}
        {!isTeknisi && (
          <StatCard 
            title="Total Isolir" 
            value={isolationCount} 
            icon={<WifiOff className="h-6 w-6 text-orange-600 dark:text-orange-400" />}
            trend="Aktif"
            color="bg-orange-50 dark:bg-orange-900/20"
          />
        )}
        <StatCard 
          title="Total port ODP" 
          value={odpTotal} 
          icon={<Wifi className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
          trend="Total"
          color="bg-emerald-50 dark:bg-emerald-900/20"
        />
        <StatCard 
          title="Total Ticketing" 
          value={ticketingTotal} 
          icon={<Wrench className="h-6 w-6 text-slate-700 dark:text-slate-200" />}
          trend="Total"
          color="bg-slate-100 dark:bg-slate-700/40"
        />
      </div>

      {/* Marketing Table */}
      {!isTeknisi && (
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Kinerja Marketing</h3>
            <p className="text-xs text-gray-500">Laporan pencapaian individu</p>
          </div>
          <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Marketing</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Progres</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-green-500 dark:text-green-400 uppercase tracking-wider">Close</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">On Process</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">Open</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-800 dark:text-white uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Isolir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {marketingData.map((item, index) => {
                const target = 20
                const progress = (item.close / target) * 100
                
                return (
                  <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-3 shadow-sm">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="w-full max-w-[120px] mx-auto">
                        <div className="flex justify-between text-[10px] mb-1 text-gray-500">
                          <span>Capaian</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          {(() => {
                            const pct = Math.round(progress)
                            const colorClass = pct < 50 ? 'bg-red-500' : pct < 75 ? 'bg-amber-500' : 'bg-green-500'
                            return (
                              <div
                                className={`${colorClass} h-1.5 rounded-full`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            )
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        {item.close}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                        {item.on_progress}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        {item.open}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-800 dark:text-white">
                        {item.count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => router.push(`/isolir?marketing=${encodeURIComponent(item.name)}&status=OPEN`)}
                        className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 hover:underline"
                        title={`Lihat isolir untuk ${item.name}`}
                      >
                        {item.isolir ?? 0}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {marketingData.length > 0 && (
                <tr className="bg-yellow-100 dark:bg-yellow-900/40 font-bold border-t-2 border-yellow-200 dark:border-yellow-800">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 text-center">
                    {/* Empty for progress column */}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap text-green-700 dark:text-green-400">
                    {totalClose}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap text-blue-700 dark:text-blue-400">
                    {totalOnProgress}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap text-red-700 dark:text-red-400">
                    {totalOpen}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap text-gray-900 dark:text-white text-lg">
                    {totalCount}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap text-orange-700 dark:text-orange-400">
                    {totalIsolir}
                  </td>
                </tr>
              )}
              {marketingData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400 italic">
                    Tidak ada data marketing untuk periode ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Rekap PSB per Bulan</h3>
            <p className="text-xs text-gray-500">Tahun {year} (berdasarkan tanggal pasang)</p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <TrendingUp className="h-5 w-5 text-gray-500 dark:text-gray-300" />
          </div>
        </div>

        {(() => {
          const series = monthlyData
            .map((m) => ({ label: m.name, v: Number(m.count || 0) }))
            .filter((x) => x.v > 0)
          const max = Math.max(1, ...series.map((s) => s.v))
          const w = 1200
          const h = 260
          const padX = 44
          const padTop = 26
          const padBottom = 44
          const chartW = w - padX * 2
          const chartH = h - padTop - padBottom
          const stepX = chartW / Math.max(1, series.length - 1)

          const pts = series.map((m, i) => {
            const v = m.v
            const x = padX + stepX * i
            const y = padTop + chartH * (1 - v / max)
            return { x, y, v, label: m.label }
          })
          const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ')
          return (
            <div className="w-full overflow-x-auto">
              <div className="min-w-[760px]">
                {pts.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                    Belum ada data PSB untuk tahun ini
                  </div>
                ) : (
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const y = padTop + (chartH / 4) * i
                    return (
                      <line
                        key={i}
                        x1={padX}
                        y1={y}
                        x2={padX + chartW}
                        y2={y}
                        stroke="currentColor"
                        className="text-gray-200 dark:text-gray-700"
                        strokeWidth={1}
                      />
                    )
                  })}

                  {pts.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={pointsStr}
                    />
                  )}

                  {pts.map((p, idx) => (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r={5} fill="#3b82f6" />
                      <circle cx={p.x} cy={p.y} r={9} fill="rgba(59,130,246,0.12)" />
                      <text
                        x={p.x}
                        y={p.y - 12}
                        textAnchor="middle"
                        className="fill-gray-700 dark:fill-gray-200"
                        style={{ fontSize: 14, fontWeight: 600 }}
                      >
                        {p.v}
                      </text>
                      <text
                        x={p.x}
                        y={h - 14}
                        textAnchor="middle"
                        className="fill-gray-500 dark:fill-gray-300"
                        style={{ fontSize: 14, fontWeight: 500 }}
                      >
                        {p.label}
                      </text>
                    </g>
                  ))}
                </svg>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Rekap Ticketing Tahunan (Tahun {year})</h3>
            <p className="text-xs text-gray-500">Ringkasan ticketing berdasarkan kategori</p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <Wrench className="h-5 w-5 text-gray-600 dark:text-gray-200" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">Open</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-green-500 dark:text-green-400 uppercase tracking-wider">Close</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-800 dark:text-white uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {ticketingYearRecap.map((r) => (
                <tr key={r.type} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{r.type}</td>
                  <td className="px-4 py-3 text-center text-sm text-red-700 dark:text-red-300">{r.open}</td>
                  <td className="px-4 py-3 text-center text-sm text-green-700 dark:text-green-300">{r.close}</td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">{r.total}</td>
                </tr>
              ))}
              {ticketingYearRecap.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400 italic">
                    Tidak ada data ticketing untuk tahun ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paket Terlaris Tahunan (sembunyikan untuk role MARKETING) */}
      {!isMarketing && !isTeknisi && (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {yearTopPackages.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{p.count}</span>
              </div>
            ))}
            {yearTopPackages.length === 0 && (
              <div className="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 italic">
                Tidak ada data paket untuk tahun ini
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pelanggan per Marketing (Tahunan) - hanya non MARKETING */}
      {!isMarketing && !isTeknisi && (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {yearMarketingCounts.map((m, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{m.count}</span>
              </div>
            ))}
            {yearMarketingCounts.length === 0 && (
              <div className="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 italic">
                Tidak ada data untuk tahun ini
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, icon, trend, color }: { title: string, value: number, icon: React.ReactNode, trend: string, color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-gray-800 dark:text-white">{value}</h3>
        </div>
        <div className={clsx("rounded-xl p-3", color)}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm">
        <span className="font-medium text-gray-600 dark:text-gray-300">{trend}</span>
        <span className="ml-2 text-gray-400 text-xs">pada periode ini</span>
      </div>
    </div>
  )
}
