'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface DashboardViewProps {
  packageData: { name: string; count: number }[]
  marketingData: { name: string; count: number; open: number; close: number }[]
  initialPeriod: { month: number; year: number }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function DashboardView({ packageData, marketingData, initialPeriod }: DashboardViewProps) {
  const router = useRouter()
  const [month, setMonth] = useState(initialPeriod.month)
  const [year, setYear] = useState(initialPeriod.year)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleFilter = () => {
    router.push(`/?month=${month}&year=${year}`)
  }

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]

  const years = [2024, 2025, 2026, 2027]

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="flex w-fit items-center space-x-4 rounded-lg bg-white p-4 shadow-sm">
           <div className="h-10 w-64 animate-pulse bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const totalOpen = marketingData.reduce((acc, curr) => acc + curr.open, 0)
  const totalClose = marketingData.reduce((acc, curr) => acc + curr.close, 0)
  const totalCount = marketingData.reduce((acc, curr) => acc + curr.count, 0)

  return (
    <div className="space-y-6">
      <div className="inline-flex flex-col space-y-2 rounded-lg bg-white dark:bg-gray-800 p-3 shadow-sm md:flex-row md:items-center md:space-y-0 md:space-x-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">Filter:</h2>
        <div className="flex w-full flex-col space-y-2 md:w-auto md:flex-row md:items-center md:space-y-0 md:space-x-2">
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-500 dark:text-gray-400">Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-black dark:text-white md:w-32"
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-500 dark:text-gray-400">Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-black dark:text-white md:w-24"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end h-full pt-4">
             <button
               onClick={handleFilter}
               className="w-full rounded-md bg-blue-600 px-4 py-1 text-sm text-white hover:bg-blue-700 md:w-auto"
             >
               Terapkan
             </button>
          </div>
        </div>
      </div>


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-gray-600 dark:text-gray-400">Statistik Paket PSB</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={packageData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  tick={false} 
                  axisLine={true}
                  height={10}
                  stroke="#9ca3af"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', borderRadius: '4px', border: 'none', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}
                />
                <Bar dataKey="count" name="Jumlah" barSize={35} radius={[4, 4, 0, 0]}>
                  {packageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList dataKey="count" position="top" fontSize={10} fontWeight="500" fill="#9ca3af" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {packageData.map((item, index) => (
              <div key={index} className="flex items-center">
                <div 
                  className="mr-1.5 h-2.5 w-2.5 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="mb-3 text-base font-bold text-gray-600 dark:text-gray-400 text-center uppercase tracking-wide">Pencapaian Marketing</h3>
          <div className="w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
                  <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    Marketing
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                    Open
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
                    Close
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-yellow-500 dark:text-yellow-400">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {marketingData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                      {item.name}
                    </td>
                    <td className="px-4 py-2 text-xs text-red-600 dark:text-red-400 text-center font-medium">
                      {item.open}
                    </td>
                    <td className="px-4 py-2 text-xs text-green-600 dark:text-green-400 text-center font-medium">
                      {item.close}
                    </td>
                    <td className="px-4 py-2 text-xs text-yellow-500 dark:text-yellow-400 text-center font-bold">
                      {item.count}
                    </td>
                  </tr>
                ))}
                {marketingData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-xs text-gray-400 italic">
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 dark:border-gray-600">
                <tr className="bg-gray-50/50 dark:bg-gray-700/50">
                  <td className="px-4 py-3 text-xs font-bold text-yellow-500 dark:text-yellow-400 uppercase tracking-wider text-center">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-yellow-500 dark:text-yellow-400 text-center">
                    {totalOpen}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-yellow-500 dark:text-yellow-400 text-center">
                    {totalClose}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-yellow-500 dark:text-yellow-400 text-center">
                    {totalCount}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
