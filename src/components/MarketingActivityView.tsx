'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { Plus, Edit2, Trash2, X, Search, Calendar, Download, Upload, ChevronRight, ChevronDown, BarChart2, Users } from 'lucide-react'

interface MarketingActivity {
  id: number
  date: string
  marketingName: string
  activity: string
  notes?: string | null
  areaId?: number | null
  area?: { name: string } | null
  areaId2?: number | null
  area2?: { name: string } | null
  areaId3?: number | null
  area3?: { name: string } | null
  areaId4?: number | null
  area4?: { name: string } | null
  createdAt: string
  updatedAt: string
}

interface CoveredArea {
  id: number
  name: string
}

interface MarketingActivityViewProps {
  userRole: string
  userName: string
}

export function MarketingActivityView({ userRole, userName }: MarketingActivityViewProps) {
  const router = useRouter()
  const [activities, setActivities] = useState<MarketingActivity[]>([])
  const [coveredAreas, setCoveredAreas] = useState<CoveredArea[]>([])
  const [expandedMarketing, setExpandedMarketing] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'marketing' | 'area'>('marketing')
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<MarketingActivity | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // Filters
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [marketingSearch, setMarketingSearch] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    marketingName: userRole === 'MARKETING' ? userName : '',
    areaId: '',
    areaId2: '',
    areaId3: '',
    areaId4: '',
    activity: '',
    notes: '',
  })

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch areas if not loaded
      if (coveredAreas.length === 0) {
        const areasRes = await fetch('/api/covered-areas')
        if (areasRes.ok) {
          const areasData = await areasRes.json()
          setCoveredAreas(areasData)
        }
      }

      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
      })
      if (marketingSearch) params.append('marketing', marketingSearch)
      
      const res = await fetch(`/api/marketing-activities?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data)
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }, [month, year, marketingSearch])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const handleOpenModal = (activity: MarketingActivity | null = null) => {
    if (activity) {
      setEditingActivity(activity)
      setFormData({
        date: format(new Date(activity.date), 'yyyy-MM-dd'),
        marketingName: activity.marketingName,
        areaId: activity.areaId?.toString() || '',
        areaId2: activity.areaId2?.toString() || '',
        areaId3: activity.areaId3?.toString() || '',
        areaId4: activity.areaId4?.toString() || '',
        activity: activity.activity,
        notes: activity.notes || '',
      })
    } else {
      setEditingActivity(null)
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        marketingName: userRole === 'MARKETING' ? userName : '',
        areaId: '',
        areaId2: '',
        areaId3: '',
        areaId4: '',
        activity: '',
        notes: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const method = editingActivity ? 'PUT' : 'POST'
      const url = editingActivity 
        ? `/api/marketing-activities/${editingActivity.id}`
        : '/api/marketing-activities'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setIsModalOpen(false)
        fetchActivities()
      } else {
        const error = await res.json()
        alert(error.error || 'Terjadi kesalahan')
      }
    } catch (error) {
      console.error('Failed to submit activity:', error)
      alert('Gagal menyimpan aktivitas')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus aktivitas ini?')) return

    try {
      const res = await fetch(`/api/marketing-activities/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchActivities()
      }
    } catch (error) {
      console.error('Failed to delete activity:', error)
      alert('Gagal menghapus aktivitas')
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const XLSX = await import('xlsx')
      const dataToExport = activities.map(a => ({
        'Tanggal': format(new Date(a.date), 'dd/MM/yyyy'),
        'Nama Marketing': a.marketingName,
        'Area 1': a.area?.name || '-',
        'Area 2': a.area2?.name || '-',
        'Area 3': a.area3?.name || '-',
        'Area 4': a.area4?.name || '-',
        'Aktivitas': a.activity,
        'Keterangan': a.notes || '-'
      }))

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Aktivitas Marketing')
      XLSX.writeFile(workbook, `Aktivitas_Marketing_${months[month-1]}_${year}.xlsx`)
    } catch (error) {
      console.error('Export error:', error)
      alert('Gagal export data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/marketing-activities/import', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const result = await res.json()
        alert(result.message)
        fetchActivities()
      } else {
        const error = await res.json()
        alert(error.error || 'Gagal import data')
      }
    } catch (error) {
      console.error('Import error:', error)
      alert('Terjadi kesalahan saat import')
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  // Grouping logic
  const groupedActivities = activities.reduce((acc, curr) => {
    const name = curr.marketingName
    if (!acc[name]) {
      acc[name] = {
        name,
        activities: [],
        count: 0,
        noCount: 0
      }
    }
    acc[name].activities.push(curr)
    // If activity is "-" or empty, it counts as "tidak"
    if (curr.activity === '-' || !curr.activity.trim()) {
      acc[name].noCount++
    } else {
      acc[name].count++
    }
    return acc
  }, {} as Record<string, { name: string; activities: MarketingActivity[]; count: number; noCount: number }>)

  const sortedMarketingNames = Object.keys(groupedActivities).sort()

  // Area statistics calculation
  const areaVisitCounts = new Map<number, number>()
  for (const a of activities) {
    const ids = [a.areaId, a.areaId2, a.areaId3, a.areaId4].filter(
      (x): x is number => typeof x === 'number' && x > 0
    )
    const uniqueIds = Array.from(new Set(ids))
    for (const id of uniqueIds) {
      areaVisitCounts.set(id, (areaVisitCounts.get(id) || 0) + 1)
    }
  }
  const totalAreaVisits = Array.from(areaVisitCounts.values()).reduce((sum, v) => sum + v, 0)

  const areaStats = coveredAreas.map(area => {
    const visits = areaVisitCounts.get(area.id) || 0
    return {
      ...area,
      visits,
      percentage: totalAreaVisits > 0 ? (visits / totalAreaVisits) * 100 : 0
    }
  }).sort((a, b) => b.visits - a.visits)

  const areaFields = ['areaId', 'areaId2', 'areaId3', 'areaId4'] as const
  const selectedAreaValues = areaFields.map(f => formData[f]).filter(Boolean)
  const getAvailableAreas = (currentValue: string) =>
    coveredAreas.filter(a => !selectedAreaValues.includes(a.id.toString()) || a.id.toString() === currentValue)

  const updateAreaField = (field: typeof areaFields[number], value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (value) {
        for (const f of areaFields) {
          if (f !== field && next[f] === value) next[f] = ''
        }
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* View Switcher and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col gap-4 flex-1 w-full">
          <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-lg w-fit">
            <button
              onClick={() => setViewMode('marketing')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all",
                viewMode === 'marketing'
                  ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <Users className="h-4 w-4" />
              Per Marketing
            </button>
            <button
              onClick={() => setViewMode('area')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all",
                viewMode === 'area'
                  ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <BarChart2 className="h-4 w-4" />
              Analisis Area
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bulan</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
              >
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tahun</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {userRole !== 'MARKETING' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cari Marketing</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={marketingSearch}
                    onChange={(e) => setMarketingSearch(e.target.value)}
                    placeholder="Nama marketing..."
                    className="w-full pl-9 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 w-full lg:w-auto mt-4 lg:mt-0">
          {['ADMIN', 'CS', 'NOC'].includes(userRole) && (
            <>
              <button
                disabled={isImporting}
                className="flex-1 lg:flex-none bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => document.getElementById('marketing-import-input')?.click()}
              >
                <Upload className="h-4 w-4" />
                {isImporting ? 'Import' : 'Import'}
              </button>
              <input
                id="marketing-import-input"
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleImport}
              />
            </>
          )}
          <button
            onClick={handleExport}
            disabled={isExporting || activities.length === 0}
            className="flex-1 lg:flex-none bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </div>
      </div>

      {viewMode === 'marketing' ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Marketing</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ada Aktivitas</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tidak Ada</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hari</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Memuat data...</td>
                  </tr>
                ) : sortedMarketingNames.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Tidak ada data untuk periode ini</td>
                  </tr>
                ) : (
                  sortedMarketingNames.map((name) => {
                    const group = groupedActivities[name]
                    const isExpanded = expandedMarketing === name
                    return (
                      <Fragment key={name}>
                        <tr 
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                          onClick={() => setExpandedMarketing(isExpanded ? null : name)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-bold">
                            {name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              {group.count} Hari
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              {group.noCount} Hari
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                            {group.activities.length}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="px-0 py-0 bg-gray-50/50 dark:bg-gray-900/20">
                              <div className="p-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                                  <thead className="bg-gray-100 dark:bg-gray-800">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Tanggal</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Area</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Aktivitas</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Keterangan</th>
                                      <th className="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase w-24">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                    {group.activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((activity) => (
                                      <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                                          {format(new Date(activity.date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-blue-600 dark:text-blue-400">
                                        {[activity.area?.name, activity.area2?.name, activity.area3?.name, activity.area4?.name].filter(Boolean).join(', ') || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100">
                                          {activity.activity === '-' ? (
                                            <span className="text-red-500 italic font-medium">Tidak Ada Aktivitas</span>
                                          ) : activity.activity}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 italic">
                                          {activity.notes || '-'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-center">
                                          <div className="flex justify-center gap-1">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleOpenModal(activity); }}
                                              className="text-blue-600 hover:text-blue-900 p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                              title="Edit"
                                            >
                                              <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                            {['ADMIN', 'CS', 'NOC'].includes(userRole) && (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(activity.id); }}
                                                className="text-red-600 hover:text-red-900 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="Hapus"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-500" />
                Persentase Kunjungan Per Area
              </h3>
              <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md">
                Total: {totalAreaVisits} Kunjungan
              </span>
            </div>
            <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar">
              {areaStats.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm italic">
                  Belum ada data area terdaftar atau aktivitas ditemukan.
                </div>
              ) : (
                areaStats.map((stat) => (
                  <div key={stat.id} className="space-y-2 group">
                    <div className="flex justify-between items-end">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors uppercase">
                          {stat.name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {stat.visits} Kunjungan
                        </span>
                      </div>
                      <span className={clsx(
                        "text-xs font-bold",
                        stat.percentage > 20 ? "text-green-600" : stat.percentage > 5 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {stat.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={clsx(
                          "h-full rounded-full transition-all duration-1000 ease-out shadow-sm",
                          stat.percentage > 20 ? "bg-green-500" : stat.percentage > 5 ? "bg-yellow-500" : "bg-red-500"
                        )}
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center text-center space-y-2">
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-2">
                <BarChart2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Informasi Analitik</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Persentase dihitung berdasarkan jumlah kunjungan ke area tertentu dibandingkan dengan total seluruh aktivitas marketing pada periode yang dipilih.
              </p>
              <div className="flex gap-4 pt-4 w-full">
                <div className="flex-1 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/20">
                  <div className="text-[10px] font-bold text-green-600 uppercase mb-1">Paling Sering</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {areaStats[0]?.visits > 0 ? areaStats[0].name : '-'}
                  </div>
                </div>
                <div className="flex-1 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                  <div className="text-[10px] font-bold text-red-600 uppercase mb-1">Paling Jarang</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {areaStats.filter(s => s.visits > 0).pop()?.name || areaStats[areaStats.length - 1]?.name || '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg p-6 text-white space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Search className="h-4 w-4" />
                Tips Strategi Marketing
              </h4>
              <ul className="space-y-3">
                <li className="flex gap-3 text-xs opacity-90">
                  <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">1</div>
                  <p>Fokuskan marketing ke area dengan persentase <span className="font-bold underline">Merah</span> untuk memperluas jangkauan.</p>
                </li>
                <li className="flex gap-3 text-xs opacity-90">
                  <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">2</div>
                  <p>Evaluasi area <span className="font-bold underline">Hijau</span>, apakah sudah mencapai target penjualan yang maksimal?</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingActivity ? 'Edit Aktivitas' : 'Tambah Aktivitas'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Marketing</label>
                  <input
                    type="text"
                    required
                    readOnly={userRole === 'MARKETING'}
                    value={formData.marketingName}
                    onChange={(e) => setFormData({ ...formData, marketingName: e.target.value })}
                    className={clsx(
                      "w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm",
                      userRole === 'MARKETING' && "bg-gray-50 dark:bg-gray-600 cursor-not-allowed"
                    )}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Area 1 (Opsional)</label>
                  <select
                    value={formData.areaId}
                    onChange={(e) => updateAreaField('areaId', e.target.value)}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  >
                    <option value="">- Pilih Area -</option>
                    {getAvailableAreas(formData.areaId).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Area 2 (Opsional)</label>
                  <select
                    value={formData.areaId2}
                    onChange={(e) => updateAreaField('areaId2', e.target.value)}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  >
                    <option value="">- Pilih Area -</option>
                    {getAvailableAreas(formData.areaId2).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Area 3 (Opsional)</label>
                  <select
                    value={formData.areaId3}
                    onChange={(e) => updateAreaField('areaId3', e.target.value)}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  >
                    <option value="">- Pilih Area -</option>
                    {getAvailableAreas(formData.areaId3).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Area 4 (Opsional)</label>
                  <select
                    value={formData.areaId4}
                    onChange={(e) => updateAreaField('areaId4', e.target.value)}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  >
                    <option value="">- Pilih Area -</option>
                    {getAvailableAreas(formData.areaId4).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aktivitas (Opsional)</label>
                <textarea
                  rows={2}
                  value={formData.activity}
                  onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  placeholder="Apa yang dikerjakan? (Bisa dikosongkan jika hanya kunjungan area)"
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan tambahan..."
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? 'Menyimpan...' : (editingActivity ? 'Simpan Perubahan' : 'Tambah Aktivitas')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
