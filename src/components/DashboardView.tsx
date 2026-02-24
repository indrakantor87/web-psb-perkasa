'use client'

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie
} from 'recharts'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { 
  LayoutDashboard, 
  Ticket, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Calendar,
  Filter,
  TrendingUp,
  User,
  WifiOff
} from 'lucide-react'

interface DashboardViewProps {
  packageData: { name: string; count: number }[]
  marketingData: { name: string; count: number; open: number; pending: number; close: number }[]
  statusCounts: { total: number; open: number; close: number; pending: number; on_progress: number }
  initialPeriod: { month: number; year: number }
  userRole?: string
  isolationCount?: number
}

const BAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1']

export function DashboardView({ packageData, marketingData, statusCounts, initialPeriod, userRole, isolationCount = 0 }: DashboardViewProps) {
  const router = useRouter()
  const [month, setMonth] = useState(initialPeriod.month)
  const [year, setYear] = useState(initialPeriod.year)
  const [mounted, setMounted] = useState(false)
  const isMarketing = userRole === 'MARKETING'

  useEffect(() => {
    setMounted(true)
  }, [])

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]

  const years = [2024, 2025, 2026, 2027]

  if (!mounted) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex w-fit items-center space-x-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
           <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-white dark:bg-gray-800 shadow-sm"></div>
          ))}
        </div>
      </div>
    )
  }

  const totalOpen = marketingData.reduce((acc, curr) => acc + curr.open, 0)
  const totalPending = marketingData.reduce((acc, curr) => acc + curr.pending, 0)
  const totalClose = marketingData.reduce((acc, curr) => acc + curr.close, 0)
  const totalCount = marketingData.reduce((acc, curr) => acc + curr.count, 0)

  const statusData = [
    { name: 'Open', value: statusCounts.open, color: '#ef4444' }, // Red
    { name: 'Close', value: statusCounts.close, color: '#10b981' }, // Green
    { name: 'On Progress', value: statusCounts.on_progress, color: '#3b82f6' }, // Blue
    { name: 'Pending', value: statusCounts.pending, color: '#f59e0b' }, // Yellow
  ].filter(item => item.value > 0)

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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard 
          title="Total Tiket" 
          value={statusCounts.total} 
          icon={<Ticket className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
          trend="Total"
          color="bg-blue-50 dark:bg-blue-900/20"
        />
        <StatCard 
          title="Selesai" 
          value={statusCounts.close} 
          icon={<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />}
          trend={`${Math.round((statusCounts.close / (statusCounts.total || 1)) * 100)}% Tingkat`}
          color="bg-green-50 dark:bg-green-900/20"
        />
        <StatCard 
          title="Sedang Proses" 
          value={statusCounts.on_progress} 
          icon={<Clock className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
          trend="Aktif"
          color="bg-indigo-50 dark:bg-indigo-900/20"
        />
        <StatCard 
          title="Pending / Terbuka" 
          value={statusCounts.open + statusCounts.pending} 
          icon={<AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />}
          trend="Perlu Tindakan"
          color="bg-red-50 dark:bg-red-900/20"
        />
        <StatCard 
          title="Isolir Aktif" 
          value={isolationCount} 
          icon={<WifiOff className="h-6 w-6 text-orange-600 dark:text-orange-400" />}
          trend="Perlu Penanganan"
          color="bg-orange-50 dark:bg-orange-900/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Package Chart */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Distribusi Paket</h3>
              <p className="text-xs text-gray-500">Rincian paket PSB terjual</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <LayoutDashboard className="h-5 w-5 text-gray-500 dark:text-gray-300" />
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={packageData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#9ca3af' }} 
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fontSize: 11, fill: '#9ca3af' }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: '12px'
                  }}
                  cursor={{ fill: 'rgba(156, 163, 175, 0.05)' }}
                />
                <Bar dataKey="count" name="Jumlah" barSize={40} radius={[6, 6, 0, 0]} isAnimationActive={true}>
                  {packageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                  <LabelList dataKey="count" position="top" offset={10} fontSize={11} fontWeight="600" fill="#6b7280" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Ringkasan Status</h3>
            <p className="text-xs text-gray-500">Rasio status tiket saat ini</p>
          </div>
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-gray-600 dark:text-gray-300 ml-1">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-800 dark:text-white">{statusCounts.total}</span>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Marketing Table */}
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
                <th className="px-6 py-4 text-center text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">Pending</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">Open</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-800 dark:text-white uppercase tracking-wider">Total</th>
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
                          <div 
                            className="bg-green-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        {item.close}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                        {item.pending}
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
                  <td className="px-6 py-4 text-center whitespace-nowrap text-amber-700 dark:text-amber-400">
                    {totalPending}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap text-red-700 dark:text-red-400">
                    {totalOpen}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap text-gray-900 dark:text-white text-lg">
                    {totalCount}
                  </td>
                </tr>
              )}
              {marketingData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400 italic">
                    Tidak ada data marketing untuk periode ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
