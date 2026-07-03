'use client'

import { useState, useEffect, useCallback, Fragment, useMemo } from 'react'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { Plus, Edit2, Trash2, X, Search, Download, Upload, ChevronRight, ChevronDown, BarChart2, Users } from 'lucide-react'

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

export type MarketingActivityDivision = 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'

export interface MarketingActivityViewProps {
  userRole: string
  userName: string
  initialDivision?: MarketingActivityDivision
  readOnly?: boolean
}

function getDivisionFromUrl(): MarketingActivityDivision | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('division')
    if (
      raw === 'ALL' ||
      raw === 'PENJUALAN' ||
      raw === 'CS_ADMIN' ||
      raw === 'NOC_TROUBLESHOOTS' ||
      raw === 'CREATOR_DIGITAL'
    ) {
      return raw
    }
  } catch {}

  return null
}

export function MarketingActivityView({ userRole, userName, initialDivision = 'ALL', readOnly = false }: MarketingActivityViewProps) {
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
  const [marketingOptions, setMarketingOptions] = useState<string[]>(userRole === 'MARKETING' && userName ? [userName] : [])
  const [marketingOptionsLoading, setMarketingOptionsLoading] = useState(userRole !== 'MARKETING')
  const [marketingOptionsError, setMarketingOptionsError] = useState('')

  // Filters
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [marketingSearch, setMarketingSearch] = useState('')
  const [division, setDivision] = useState<MarketingActivityDivision>(initialDivision)
  const roleUpper = (userRole || '').toUpperCase()
  const isAdmin = roleUpper === 'ADMIN'
  const isPenjualanFocus = !isAdmin || division === 'ALL' || division === 'PENJUALAN'
  const canMutate = !readOnly && isPenjualanFocus
  const divisionDescriptions: Record<MarketingActivityDivision, string> = {
    ALL: 'Modul Aktivitas Marketing saat ini merepresentasikan operasional divisi Penjualan.',
    PENJUALAN: 'Menampilkan aktivitas asli tim Penjualan/Marketing pada periode terpilih.',
    CS_ADMIN: 'Belum ada relasi langsung antara divisi CS & Admin CS dan modul Aktivitas Marketing, jadi tampilan ini masih placeholder.',
    NOC_TROUBLESHOOTS: 'Belum ada relasi langsung antara divisi NOC & Troubleshoots dan modul Aktivitas Marketing, jadi tampilan ini masih placeholder.',
    CREATOR_DIGITAL: 'Belum ada relasi langsung antara divisi Creator Digital dan modul Aktivitas Marketing, jadi tampilan ini masih placeholder.',
  }

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

  const marketingNameMap = useMemo(
    () => new Map(marketingOptions.map((name) => [name.trim().toLowerCase(), name])),
    [marketingOptions]
  )

  const canonicalizeMarketingName = useCallback(
    (name: string) => {
      const normalized = name.trim().replace(/\s+/g, ' ')
      if (!normalized) return 'Belum Diisi'
      return marketingNameMap.get(normalized.toLowerCase()) ?? 'Marketing Tidak Valid'
    },
    [marketingNameMap]
  )

  const resolveMarketingOptionValue = useCallback(
    (name: string) => {
      const normalized = name.trim().replace(/\s+/g, ' ')
      if (!normalized) return ''
      return marketingNameMap.get(normalized.toLowerCase()) ?? ''
    },
    [marketingNameMap]
  )

  useEffect(() => {
    const urlDivision = getDivisionFromUrl()
    if (urlDivision) {
      setDivision(urlDivision)
    }
  }, [])

  useEffect(() => {
    if (userRole === 'MARKETING') {
      setMarketingOptions(userName ? [userName] : [])
      setMarketingOptionsLoading(false)
      setMarketingOptionsError('')
      return
    }

    let mounted = true
    setMarketingOptionsLoading(true)
    setMarketingOptionsError('')

    ;(async () => {
      try {
        const res = await fetch('/api/users?role=MARKETING', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch marketing users')
        const data = (await res.json()) as Array<{ name?: string }>
        const names = Array.from(
          new Set(
            data
              .map((userRow) => String(userRow.name ?? '').trim())
              .filter((value) => value.length > 0)
          )
        )

        if (!mounted) return
        setMarketingOptions(names)
        setFormData((prev) => ({
          ...prev,
          marketingName: names.includes(prev.marketingName) ? prev.marketingName : names[0] ?? '',
        }))
      } catch {
        if (!mounted) return
        setMarketingOptions([])
        setMarketingOptionsError('Daftar marketing gagal dimuat. Tambahkan user marketing yang valid terlebih dahulu.')
      } finally {
        if (mounted) setMarketingOptionsLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [userName, userRole])

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
      if (isAdmin && division !== 'ALL') params.append('division', division)
      
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
  }, [coveredAreas.length, division, isAdmin, marketingSearch, month, year])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Pull to refresh support
  useEffect(() => {
    const handler = (ev: Event) => {
      const customEv = ev as CustomEvent
      if (customEv.detail && typeof customEv.detail.register === 'function') {
        customEv.detail.register(fetchActivities())
      } else {
        fetchActivities()
      }
    }
    window.addEventListener('app:refresh', handler)
    return () => window.removeEventListener('app:refresh', handler)
  }, [fetchActivities])

  const handleOpenModal = (activity: MarketingActivity | null = null) => {
    if (!canMutate) return
    if (activity) {
      setEditingActivity(activity)
      setFormData({
        date: format(new Date(activity.date), 'yyyy-MM-dd'),
        marketingName: userRole === 'MARKETING' ? userName : resolveMarketingOptionValue(activity.marketingName),
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
    if (!canMutate) return
    if (userRole !== 'MARKETING' && !formData.marketingName) {
      alert('Pilih nama marketing dari daftar user marketing yang valid.')
      return
    }
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
    if (!canMutate) return
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
    if (!canMutate) return
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
    const name = canonicalizeMarketingName(curr.marketingName)
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
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-4 flex-1 w-full">
          <div className="flex w-fit rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
            <button
              onClick={() => setViewMode('marketing')}
              className={clsx(
                "flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-all",
                viewMode === 'marketing'
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <Users className="h-4 w-4" />
              Per Marketing
            </button>
            <button
              onClick={() => setViewMode('area')}
              className={clsx(
                "flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-all",
                viewMode === 'area'
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <BarChart2 className="h-4 w-4" />
              Analisis Area
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Bulan</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Tahun</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {userRole !== 'MARKETING' && (
              <div className="col-span-2 sm:col-span-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cari Marketing</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={marketingSearch}
                    onChange={(e) => setMarketingSearch(e.target.value)}
                    placeholder="Nama marketing..."
                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            )}
            {isAdmin && (
              <div className="col-span-2 sm:col-span-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Divisi</label>
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value as 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
        
        <div className="flex gap-2 w-full lg:w-auto mt-4 lg:mt-0">
          {canMutate && (
            <>
              <button
                disabled={isImporting || !isPenjualanFocus}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 lg:flex-none"
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
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 lg:flex-none"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => handleOpenModal()}
            disabled={!canMutate}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white lg:flex-none"
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {divisionDescriptions[division]}
        </div>
      )}

      {readOnly && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          Role Anda hanya dapat melihat aktivitas marketing tanpa tambah, edit, import, atau hapus.
        </div>
      )}

      {marketingOptionsError && isPenjualanFocus && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {marketingOptionsError}
        </div>
      )}

      {viewMode === 'marketing' ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="mp-table-enhanced overflow-x-auto">
            <table className="w-full min-w-[720px] divide-y divide-gray-200 dark:divide-gray-700 md:min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="w-10 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300"></th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Marketing</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Ada Aktivitas</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Tidak Ada</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Total Hari</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Memuat data...</td>
                  </tr>
                ) : sortedMarketingNames.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      {isPenjualanFocus
                        ? 'Tidak ada data untuk periode ini'
                        : 'Belum ada data untuk divisi ini di modul Aktivitas Marketing'}
                    </td>
                  </tr>
                ) : (
                  sortedMarketingNames.map((name) => {
                    const group = groupedActivities[name]
                    const isExpanded = expandedMarketing === name
                    return (
                      <Fragment key={name}>
                        <tr 
                          className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                          onClick={() => setExpandedMarketing(isExpanded ? null : name)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-bold">
                            {name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                              {group.count} Hari
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                              {group.noCount} Hari
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                            {group.activities.length}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="px-0 py-0 bg-gray-50 dark:bg-gray-900">
                              <div className="p-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                <table className="min-w-full overflow-hidden rounded-lg border border-gray-200 divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
                                  <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">Tanggal</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">Area</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">Aktivitas</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">Keterangan</th>
                                      <th className="w-24 px-4 py-2 text-center text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                    {group.activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((activity) => (
                                      <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                                          {format(new Date(activity.date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-700 dark:text-gray-200">
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
                                            {canMutate && (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenModal(activity); }}
                                                className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
                                                title="Edit"
                                              >
                                                <Edit2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                            {canMutate && (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(activity.id); }}
                                                className="text-red-600 hover:text-red-900 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-white">
                <BarChart2 className="h-4 w-4 text-gray-500" />
                Persentase Kunjungan Per Area
              </h3>
              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                Total: {totalAreaVisits} Kunjungan
              </span>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar">
              {areaStats.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm italic">
                  {isPenjualanFocus
                    ? 'Belum ada data area terdaftar atau aktivitas ditemukan.'
                    : 'Analisis area belum tersedia untuk divisi ini karena sumber datanya belum terhubung ke modul Aktivitas Marketing.'}
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
                          stat.percentage > 20 ? "text-gray-900 dark:text-white" : stat.percentage > 5 ? "text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-300"
                      )}>
                        {stat.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div 
                        className={clsx(
                          "h-full rounded-full transition-all duration-1000 ease-out shadow-sm",
                          stat.percentage > 20 ? "bg-gray-700 dark:bg-gray-200" : stat.percentage > 5 ? "bg-gray-500 dark:bg-gray-400" : "bg-gray-300 dark:bg-gray-500"
                        )}
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col items-center space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800 sm:p-6">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <BarChart2 className="h-6 w-6 text-gray-700 dark:text-gray-200" />
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Informasi Analitik</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Persentase dihitung berdasarkan jumlah kunjungan ke area tertentu dibandingkan dengan total seluruh aktivitas marketing pada periode yang dipilih.
              </p>
              <div className="flex gap-4 pt-4 w-full">
                <div className="flex-1 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="mb-1 text-[10px] font-bold uppercase text-gray-500">Paling Sering</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {areaStats[0]?.visits > 0 ? areaStats[0].name : '-'}
                  </div>
                </div>
                <div className="flex-1 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="mb-1 text-[10px] font-bold uppercase text-gray-500">Paling Jarang</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {areaStats.filter(s => s.visits > 0).pop()?.name || areaStats[areaStats.length - 1]?.name || '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Search className="h-4 w-4" />
                Tips Strategi Marketing
              </h4>
              <ul className="space-y-3">
                <li className="flex gap-3 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">1</div>
                  <p>Prioritaskan area dengan kunjungan terendah untuk memperluas jangkauan.</p>
                </li>
                <li className="flex gap-3 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">2</div>
                  <p>Evaluasi area dengan kunjungan tertinggi untuk melihat potensi closing yang sudah maksimal.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in zoom-in duration-200 dark:border-gray-700 dark:bg-gray-800">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingActivity ? 'Edit Aktivitas' : 'Tambah Aktivitas'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Catat aktivitas lapangan dengan singkat dan jelas.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama Marketing</label>
                  {userRole === 'MARKETING' ? (
                    <input
                      type="text"
                      required
                      readOnly
                      value={formData.marketingName}
                      className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                    />
                  ) : (
                    <select
                      required
                      value={formData.marketingName}
                      onChange={(e) => setFormData({ ...formData, marketingName: e.target.value })}
                      disabled={marketingOptionsLoading || marketingOptions.length === 0}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-600"
                    >
                      {marketingOptionsLoading ? (
                        <option value="">Memuat daftar marketing...</option>
                      ) : marketingOptions.length === 0 ? (
                        <option value="">Belum ada user marketing</option>
                      ) : (
                        marketingOptions.map((marketingName) => (
                          <option key={marketingName} value={marketingName}>
                            {marketingName}
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Area 1</label>
                  <select
                    value={formData.areaId}
                    onChange={(e) => updateAreaField('areaId', e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">- Pilih Area -</option>
                    {getAvailableAreas(formData.areaId).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Area 2</label>
                  <select
                    value={formData.areaId2}
                    onChange={(e) => updateAreaField('areaId2', e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">- Pilih Area -</option>
                    {getAvailableAreas(formData.areaId2).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Area 3</label>
                  <select
                    value={formData.areaId3}
                    onChange={(e) => updateAreaField('areaId3', e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">- Pilih Area -</option>
                    {getAvailableAreas(formData.areaId3).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Area 4</label>
                  <select
                    value={formData.areaId4}
                    onChange={(e) => updateAreaField('areaId4', e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">- Pilih Area -</option>
                    {getAvailableAreas(formData.areaId4).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Aktivitas</label>
                <textarea
                  rows={2}
                  value={formData.activity}
                  onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  placeholder="Apa yang dikerjakan? (Bisa dikosongkan jika hanya kunjungan area)"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan tambahan..."
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || (userRole !== 'MARKETING' && (marketingOptionsLoading || marketingOptions.length === 0))}
                  className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
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
