'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { clsx } from 'clsx'
import { Plus, Edit2, Trash2, X, Search, Download, Upload, Trophy, Copy, Check, MapPin, ChevronDown, ChevronRight } from 'lucide-react'

interface MarketingActivityRecord {
  id: number
  date: string
  marketingName: string
  activity: string
  notes?: string | null
  flyer: number
  sosialisasi: number
  dataBase: number
  event: number
  total: number
  psb: number
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

interface RankingRow {
  rank: number
  name: string
  skor: number
  psb: number
  flyer: number
  sosialisasi: number
  dataBase: number
  event: number
  total: number
  totalAktivitas: number
}

export interface MarketingActivityViewProps {
  userRole: string
  userName: string
  readOnly?: boolean
}

function jakartaTodayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function toNumber(value: string) {
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function MarketingActivityView({
  userRole,
  userName,
  readOnly = false,
}: MarketingActivityViewProps) {
  const [activities, setActivities] = useState<MarketingActivityRecord[]>([])
  const [coveredAreas, setCoveredAreas] = useState<CoveredArea[]>([])
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [rankingLoading, setRankingLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [expandedMarketing, setExpandedMarketing] = useState<string | null>(null)
  const [editingActivity, setEditingActivity] = useState<MarketingActivityRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [marketingOptions, setMarketingOptions] = useState<string[]>([])
  const [marketingOptionsLoading, setMarketingOptionsLoading] = useState(false)
  const [marketingOptionsError, setMarketingOptionsError] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const now = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [marketingSearch, setMarketingSearch] = useState('')

  const roleUpper = (userRole || '').toUpperCase()
  const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'DEVELOPER'
  const canMutate = !readOnly

  const [formData, setFormData] = useState({
    date: jakartaTodayKey(),
    marketingName: '',
    areaId: '',
    flyer: '',
    sosialisasi: '',
    event: '',
    dataBase: '',
    notes: '',
  })

  // Daftar marketing (untuk admin memilih pemilik laporan)
  useEffect(() => {
    if (roleUpper === 'MARKETING') {
      setMarketingOptions(userName ? [userName] : [])
      setMarketingOptionsLoading(false)
      setMarketingOptionsError('')
      return
    }
    if (!isAdmin) return

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
  }, [isAdmin, roleUpper, userName])

  const ensureAreas = useCallback(async () => {
    if (coveredAreas.length > 0) return
    try {
      const res = await fetch('/api/covered-areas')
      if (res.ok) {
        const data = await res.json()
        setCoveredAreas(data)
      }
    } catch (error) {
      console.error('Failed to fetch covered areas:', error)
    }
  }, [coveredAreas.length])

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
      })
      if (marketingSearch) params.append('marketing', marketingSearch)

      const res = await fetch(`/api/marketing-activities?${params.toString()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setActivities(data)
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }, [marketingSearch, month, year])

  const fetchRanking = useCallback(async () => {
    setRankingLoading(true)
    try {
      const params = new URLSearchParams({ month: month.toString(), year: year.toString() })
      const res = await fetch(`/api/marketing-activities/ranking?${params.toString()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setRanking(Array.isArray(data?.rows) ? data.rows : [])
      } else {
        setRanking([])
      }
    } catch (error) {
      console.error('Failed to fetch ranking:', error)
      setRanking([])
    } finally {
      setRankingLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    void ensureAreas()
  }, [ensureAreas])

  useEffect(() => {
    void fetchActivities()
  }, [fetchActivities])

  useEffect(() => {
    void fetchRanking()
  }, [fetchRanking])

  const refreshAll = useCallback(() => {
    void fetchActivities()
    void fetchRanking()
  }, [fetchActivities, fetchRanking])

  useEffect(() => {
    const handler = (ev: Event) => {
      const customEv = ev as CustomEvent
      if (customEv.detail && typeof customEv.detail.register === 'function') {
        customEv.detail.register(refreshAll())
      } else {
        refreshAll()
      }
    }
    window.addEventListener('app:refresh', handler)
    return () => window.removeEventListener('app:refresh', handler)
  }, [refreshAll])

  const openCreateModal = () => {
    if (!canMutate) return
    setEditingActivity(null)
    setFormData({
      date: jakartaTodayKey(),
      marketingName: isAdmin ? marketingOptions[0] ?? '' : userName,
      areaId: '',
      flyer: '',
      sosialisasi: '',
      event: '',
      dataBase: '',
      notes: '',
    })
    setIsModalOpen(true)
  }

  const openEditModal = (activity: MarketingActivityRecord) => {
    if (!canMutate) return
    setEditingActivity(activity)
    setFormData({
      date: format(new Date(activity.date), 'yyyy-MM-dd'),
      marketingName: activity.marketingName,
      areaId: activity.areaId ? String(activity.areaId) : '',
      flyer: String(activity.flyer ?? 0),
      sosialisasi: String(activity.sosialisasi ?? 0),
      event: String(activity.event ?? 0),
      dataBase: String(activity.dataBase ?? 0),
      notes: activity.notes || '',
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canMutate) return
    if (isAdmin && !formData.marketingName) {
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
        body: JSON.stringify({
          date: formData.date,
          marketingName: formData.marketingName,
          areaId: formData.areaId || null,
          flyer: toNumber(formData.flyer),
          sosialisasi: toNumber(formData.sosialisasi),
          event: toNumber(formData.event),
          dataBase: toNumber(formData.dataBase),
          notes: formData.notes,
        }),
      })

      if (res.ok) {
        setIsModalOpen(false)
        refreshAll()
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
    if (!confirm('Apakah Anda yakin ingin menghapus laporan aktivitas ini?')) return

    try {
      const res = await fetch(`/api/marketing-activities/${id}`, { method: 'DELETE' })
      if (res.ok) {
        refreshAll()
      } else {
        const error = await res.json().catch(() => ({}))
        alert(error.error || 'Gagal menghapus aktivitas')
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
      const dataToExport = activities.map((a) => ({
        'Tanggal': format(new Date(a.date), 'dd/MM/yyyy'),
        'Nama Marketing': a.marketingName,
        'Aktivitas (Area)': a.area?.name || a.activity || '-',
        'Flyer': a.flyer,
        'Sosialisasi': a.sosialisasi,
        'Event': a.event,
        'Total': a.total,
        'Data Base': a.dataBase,
        'PSB': a.psb > 0 ? a.psb : '-',
        'Keterangan': a.notes || '-',
      }))

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Aktivitas Marketing')
      XLSX.writeFile(workbook, `Aktivitas_Marketing_${MONTHS[month - 1]}_${year}.xlsx`)
    } catch (error) {
      console.error('Export error:', error)
      alert('Gagal export data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const formDataFile = new FormData()
      formDataFile.append('file', file)

      const res = await fetch('/api/marketing-activities/import', {
        method: 'POST',
        body: formDataFile,
      })

      if (res.ok) {
        const result = await res.json()
        alert(result.message)
        refreshAll()
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

  const years = useMemo(
    () => Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i),
    [now]
  )

  const formTotal = toNumber(formData.flyer) + toNumber(formData.sosialisasi) + toNumber(formData.event)

  const rankingSubtitle = `Periode ${MONTHS[month - 1]} ${year} — Skor = PSB×10 + Data Base×3 + Sosialisasi×1 + Flyer×1 + Event×1. Total Aktivitas menghitung hari unik dengan laporan; Minggu dikecualikan.`

  // Statistik area yang paling sering dikunjungi (peringkat area)
  const areaStats = useMemo(() => {
    const visitCounts = new Map<number, number>()
    for (const a of activities) {
      const ids = [a.areaId, a.areaId2, a.areaId3, a.areaId4].filter(
        (x): x is number => typeof x === 'number' && x > 0
      )
      const uniqueIds = Array.from(new Set(ids))
      for (const id of uniqueIds) {
        visitCounts.set(id, (visitCounts.get(id) ?? 0) + 1)
      }
    }
    const totalVisits = Array.from(visitCounts.values()).reduce((s, v) => s + v, 0)
    return coveredAreas
      .map((area) => {
        const visits = visitCounts.get(area.id) ?? 0
        return {
          id: area.id,
          name: area.name,
          visits,
          percentage: totalVisits > 0 ? (visits / totalVisits) * 100 : 0,
        }
      })
      .sort((a, b) => b.visits - a.visits)
  }, [activities, coveredAreas])

  const totalAreaVisits = useMemo(
    () => areaStats.reduce((s, a) => s + a.visits, 0),
    [areaStats]
  )
  const topArea = areaStats.find((a) => a.visits > 0) ?? null
  const leastArea = [...areaStats].reverse().find((a) => a.visits > 0) ?? null

  const buildWhatsAppText = useCallback((activity: MarketingActivityRecord) => {
    const dateLine = format(new Date(activity.date), 'EEEE , d MMMM yyyy', { locale: idLocale })
    const area = activity.area?.name || activity.activity || '-'
    const line = (label: string, value: string) => `- ${label.padEnd(13, ' ')}: ${value}`

    return [
      '*LAPORAN AKTIVITAS HARIAN*',
      dateLine,
      `${activity.marketingName} - Marketing`,
      '',
      `*Area* : ${area}`,
      '',
      line('FLYER', String(activity.flyer)),
      line('SOSIALISASI', String(activity.sosialisasi)),
      `*${'TOTAL'.padEnd(13, ' ')}: ${activity.total}*`,
      '-'.repeat(46),
      line('DATABASE', String(activity.dataBase)),
      line('PSB', activity.psb > 0 ? String(activity.psb) : '-'),
      line('EVENT', String(activity.event)),
    ].join('\n')
  }, [])

  const handleCopy = useCallback(async (activity: MarketingActivityRecord) => {
    const text = buildWhatsAppText(activity)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopiedId(activity.id)
      setTimeout(() => setCopiedId((prev) => (prev === activity.id ? null : prev)), 1500)
    } catch (error) {
      console.error('Copy error:', error)
      alert('Gagal menyalin laporan')
    }
  }, [buildWhatsAppText])

  return (
    <div className="space-y-4">
      {/* Filter & Aksi */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 lg:flex-row lg:items-end">
        <div className="grid w-full flex-1 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cari Marketing</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={marketingSearch}
                  onChange={(e) => setMarketingSearch(e.target.value)}
                  placeholder="Nama marketing..."
                  className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full gap-2 lg:w-auto">
          {isAdmin && (
            <>
              <button
                disabled={isImporting}
                onClick={() => document.getElementById('marketing-import-input')?.click()}
                className="hidden flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 md:flex lg:flex-none"
              >
                <Upload className="h-4 w-4" />
                Import
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
            className="hidden flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 md:flex lg:flex-none"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {canMutate && (
            <button
              onClick={openCreateModal}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 lg:flex-none dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
          )}
        </div>
      </div>

      {!canMutate && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          Role Anda hanya dapat melihat laporan aktivitas marketing.
        </div>
      )}

      {isAdmin && marketingOptionsError && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {marketingOptionsError}
        </div>
      )}

      {/* Papan Peringkat Marketing */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-1 border-b border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-white">
            <Trophy className="h-4 w-4 text-amber-500" />
            Peringkat Marketing
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{rankingSubtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="w-8 px-2 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Peringkat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Nama Marketing</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Skor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">PSB</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Flyer</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Sosialisasi</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Data Base</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Total Flyer</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Event</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Total Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {rankingLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-4 text-center text-sm text-gray-500">Memuat peringkat...</td>
                </tr>
              ) : ranking.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-4 text-center text-sm text-gray-500">Belum ada data aktivitas pada periode ini.</td>
                </tr>
              ) : (
                ranking.map((row) => {
                  const isExpanded = expandedMarketing === row.name
                  const marketingActivities = activities.filter((a) => a.marketingName === row.name)
                  return (
                    <Fragment key={row.name}>
                      <tr
                        className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => setExpandedMarketing(isExpanded ? null : row.name)}
                      >
                        <td className="px-2 py-3 text-center">
                          {isExpanded ? (
                            <ChevronDown className="mx-auto h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="mx-auto h-4 w-4 text-gray-500" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">#{row.rank}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-bold text-gray-900 dark:text-gray-100">{row.skor}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{row.psb}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{row.flyer}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{row.sosialisasi}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{row.dataBase}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{row.total}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{row.event}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{row.totalAktivitas}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/60 dark:bg-gray-900/30">
                          <td colSpan={11} className="p-4">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Detail Data Harian — {row.name} ({marketingActivities.length} data)
                            </div>
                            {/* Tabel (desktop) */}
                            <div className="hidden overflow-x-auto md:block">
                              <table className="w-full min-w-[820px] divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Tanggal</th>
                                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Aktivitas (Area)</th>
                                    <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Flyer</th>
                                    <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Sosialisasi</th>
                                    <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Event</th>
                                    <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Total Flyer</th>
                                    <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Data Base</th>
                                    <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">PSB</th>
                                    <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Aksi</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                                  {loading ? (
                                    <tr>
                                      <td colSpan={9} className="px-4 py-4 text-center text-sm text-gray-500">Memuat data...</td>
                                    </tr>
                                  ) : marketingActivities.length === 0 ? (
                                    <tr>
                                      <td colSpan={9} className="px-4 py-4 text-center text-sm text-gray-500">
                                        Belum ada laporan aktivitas pada periode ini.
                                      </td>
                                    </tr>
                                  ) : (
                                    marketingActivities.map((activity) => (
                                      <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                                          {format(new Date(activity.date), 'dd MMM yyyy', { locale: idLocale })}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
                                          {activity.area?.name || activity.activity || '-'}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{activity.flyer}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{activity.sosialisasi}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{activity.event}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{activity.total}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">{activity.dataBase}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-200">
                                          {activity.psb > 0 ? activity.psb : '-'}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-center">
                                          <div className="flex justify-center gap-1">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleCopy(activity) }}
                                              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
                                              title="Salin laporan untuk WhatsApp"
                                            >
                                              {copiedId === activity.id ? (
                                                <Check className="h-3.5 w-3.5 text-green-600" />
                                              ) : (
                                                <Copy className="h-3.5 w-3.5" />
                                              )}
                                            </button>
                                            {canMutate && (
                                              <>
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); openEditModal(activity) }}
                                                  className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
                                                  title="Edit"
                                                >
                                                  <Edit2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleDelete(activity.id) }}
                                                  className="rounded-md p-1.5 text-red-600 hover:bg-red-50 hover:text-red-900 dark:hover:bg-red-950"
                                                  title="Hapus"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Kartu (mobile) */}
                            <div className="space-y-3 md:hidden">
                              {loading ? (
                                <div className="p-4 text-center text-sm text-gray-500">Memuat data...</div>
                              ) : marketingActivities.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500">Belum ada laporan aktivitas pada periode ini.</div>
                              ) : (
                                marketingActivities.map((activity) => (
                                  <div key={activity.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                                          {activity.area?.name || activity.activity || '-'}
                                        </p>
                                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                          {format(new Date(activity.date), 'EEEE, d MMMM yyyy', { locale: idLocale })}
                                        </p>
                                      </div>
                                      <div className="flex flex-shrink-0 gap-1">
                                        <button
                                          onClick={() => handleCopy(activity)}
                                          className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                                          title="Salin laporan untuk WhatsApp"
                                        >
                                          {copiedId === activity.id ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <Copy className="h-4 w-4" />
                                          )}
                                        </button>
                                        {canMutate && (
                                          <>
                                            <button
                                              onClick={() => openEditModal(activity)}
                                              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                                              title="Edit"
                                            >
                                              <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                              onClick={() => handleDelete(activity.id)}
                                              className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                              title="Hapus"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                      <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900">
                                        <span className="block text-gray-500 dark:text-gray-400">Flyer</span>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{activity.flyer}</span>
                                      </div>
                                      <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900">
                                        <span className="block text-gray-500 dark:text-gray-400">Sosialisasi</span>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{activity.sosialisasi}</span>
                                      </div>
                                      <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900">
                                        <span className="block text-gray-500 dark:text-gray-400">Event</span>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{activity.event}</span>
                                      </div>
                                      <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900">
                                        <span className="block text-gray-500 dark:text-gray-400">Total Flyer</span>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{activity.total}</span>
                                      </div>
                                      <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900">
                                        <span className="block text-gray-500 dark:text-gray-400">Data Base</span>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{activity.dataBase}</span>
                                      </div>
                                      <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900">
                                        <span className="block text-gray-500 dark:text-gray-400">PSB</span>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{activity.psb > 0 ? activity.psb : '-'}</span>
                                      </div>
                                    </div>
                                    {activity.notes && (
                                      <p className="mt-2 text-xs italic text-gray-500 dark:text-gray-400">{activity.notes}</p>
                                    )}
                                  </div>
                                ))
                              )}
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

      {/* Peringkat Area yang Sering Dikunjungi */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
            <h3 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-white">
              <MapPin className="h-4 w-4 text-gray-500" />
              Peringkat Area yang Sering Dikunjungi
            </h3>
            <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              Total: {totalAreaVisits} Kunjungan
            </span>
          </div>
          <div className="max-h-[480px] space-y-4 overflow-y-auto p-4 sm:p-6">
            {areaStats.filter((a) => a.visits > 0).length === 0 ? (
              <div className="py-10 text-center text-sm italic text-gray-500">
                Belum ada data kunjungan area pada periode ini.
              </div>
            ) : (
              areaStats
                .filter((a) => a.visits > 0)
                .map((stat) => (
                  <div key={stat.id} className="space-y-2 group">
                    <div className="flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold uppercase text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100">
                          {stat.name}
                        </span>
                        <span className="text-[10px] font-medium text-gray-500">
                          {stat.visits} Kunjungan
                        </span>
                      </div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        {stat.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className={clsx(
                          'h-full rounded-full bg-gray-700 transition-all duration-700 ease-out dark:bg-gray-200'
                        )}
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col items-center space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800 sm:p-6">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
              <MapPin className="h-6 w-6 text-gray-700 dark:text-gray-200" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              Informasi Analitik Area
            </h4>
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Persentase dihitung berdasarkan jumlah kunjungan ke area tertentu dibandingkan dengan total seluruh aktivitas marketing pada periode yang dipilih.
            </p>
            <div className="flex w-full gap-4 pt-4">
              <div className="flex-1 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-1 text-[10px] font-bold uppercase text-gray-500">Paling Sering</div>
                <div className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  {topArea ? topArea.name : '-'}
                </div>
                {topArea && (
                  <div className="text-[10px] text-gray-500">{topArea.visits} kunjungan</div>
                )}
              </div>
              <div className="flex-1 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-1 text-[10px] font-bold uppercase text-gray-500">Paling Jarang</div>
                <div className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  {leastArea ? leastArea.name : '-'}
                </div>
                {leastArea && (
                  <div className="text-[10px] text-gray-500">{leastArea.visits} kunjungan</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700 sm:px-6 sm:py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingActivity ? 'Edit Laporan Aktivitas' : 'Tambah Laporan Aktivitas'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Kolom Total &amp; PSB terisi otomatis.
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama Marketing</label>
                  {isAdmin ? (
                    <select
                      required
                      value={formData.marketingName}
                      onChange={(e) => setFormData({ ...formData, marketingName: e.target.value })}
                      disabled={marketingOptionsLoading || marketingOptions.length === 0}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-600"
                    >
                      {marketingOptionsLoading ? (
                        <option value="">Memuat daftar marketing...</option>
                      ) : marketingOptions.length === 0 ? (
                        <option value="">Belum ada user marketing</option>
                      ) : (
                        marketingOptions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      readOnly
                      value={formData.marketingName}
                      className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Aktivitas (Area)</label>
                <select
                  value={formData.areaId}
                  onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">- Pilih Area -</option>
                  {coveredAreas.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Flyer</label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={formData.flyer}
                    onChange={(e) => setFormData({ ...formData, flyer: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sosialisasi</label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={formData.sosialisasi}
                    onChange={(e) => setFormData({ ...formData, sosialisasi: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Event</label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={formData.event}
                    onChange={(e) => setFormData({ ...formData, event: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</label>
                  <input
                    type="text"
                    readOnly
                    value={formTotal}
                    className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Data Base</label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={formData.dataBase}
                    onChange={(e) => setFormData({ ...formData, dataBase: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">PSB</label>
                <input
                  type="text"
                  readOnly
                  value={
                    editingActivity
                      ? editingActivity.psb > 0
                        ? editingActivity.psb
                        : '-'
                      : '- (otomatis dari list PSB)'
                  }
                  className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan tambahan..."
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className={clsx('flex justify-end gap-3 pt-4')}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || (isAdmin && (marketingOptionsLoading || marketingOptions.length === 0))}
                  className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {submitting ? 'Menyimpan...' : editingActivity ? 'Simpan Perubahan' : 'Tambah Aktivitas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
