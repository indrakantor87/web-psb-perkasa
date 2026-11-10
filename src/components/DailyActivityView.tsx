'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { format, startOfWeek, endOfWeek, endOfMonth, eachDayOfInterval } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { clsx } from 'clsx'
import {
  Plus,
  X,
  Search,
  Download,
  Copy,
  Check,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  ClipboardList,
  ClipboardPaste,
  BarChart2,
  Calendar,
  Users,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import type {
  DailyActivityPageData,
  DailyActivityItemDto,
  DailyActivityScope,
} from '@/lib/daily-activity-service'
import {
  DAILY_ACTIVITY_EXECUTION_STATUSES,
  DAILY_ACTIVITY_PRIORITY_LEVELS,
  DAILY_ACTIVITY_PLANNING_LEVELS,
  DAILY_ACTIVITY_EXECUTION_STATUS_LABELS,
  DAILY_ACTIVITY_PRIORITY_LABELS,
  getAllDailyActivityDivisions,
  getDailyActivitySubdivisions,
  type DailyActivityPlanningLevel,
  type DailyActivityPriorityLevel,
  type DailyActivityExecutionStatus,
} from '@/lib/daily-activity-org'

type ScopeMode = 'all' | 'mine' | 'team'
type TabKey = 'workspace' | 'performance' | 'calendar' | 'profile'

const DIVISIONS = getAllDailyActivityDivisions()
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-600'
const LABEL_CLASS = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'

function jakartaTodayKey() {
  return new Date(Date.now() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10)
}

function monthStartKey(key: string) {
  return `${key.slice(0, 7)}-01`
}

function monthEndKey(key: string) {
  const [y, m] = key.split('-').map((part) => Number(part))
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map((part) => Number(part))
  return new Date(y, (m || 1) - 1, d || 1)
}

function formatDateLabel(key: string) {
  return format(parseDateKey(key), 'EEEE, dd MMM yyyy', { locale: idLocale })
}

function executionBadgeClass(status: DailyActivityExecutionStatus) {
  return clsx(
    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
    status === 'DONE'
      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
      : status === 'PENDING'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        : status === 'CANCEL'
          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  )
}

function priorityBadgeClass(level: DailyActivityPriorityLevel) {
  return clsx(
    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
    level === 'HIGH'
      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
      : level === 'LOW'
        ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
  )
}

function progressBarClass(status: DailyActivityExecutionStatus) {
  return status === 'DONE'
    ? 'bg-green-500'
    : status === 'CANCEL'
      ? 'bg-red-400'
      : status === 'PENDING'
        ? 'bg-amber-400'
        : 'bg-blue-500'
}

function canEditItem(scope: DailyActivityScope, item: DailyActivityItemDto) {
  if (scope.isAdmin) return true
  return item.ownerUserId === scope.userId
}

type ParsedPasteRow = {
  title: string
  location: string
  target: string
  priorityLevel: DailyActivityPriorityLevel
}

function parseSmartPaste(text: string): ParsedPasteRow[] {
  const rows: ParsedPasteRow[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/\t|\|/).map((part) => part.trim())
    const title = parts[0] ?? ''
    if (!title) continue
    const priorityRaw = (parts[3] ?? '').toUpperCase()
    const priorityLevel = (DAILY_ACTIVITY_PRIORITY_LEVELS as readonly string[]).includes(priorityRaw)
      ? (priorityRaw as DailyActivityPriorityLevel)
      : 'MEDIUM'
    rows.push({ title, location: parts[1] ?? '', target: parts[2] ?? '', priorityLevel })
  }
  return rows
}

export interface DailyActivityViewProps {
  userRole: string
  userName: string
  readOnly?: boolean
}

export function DailyActivityView({ userRole, userName, readOnly = false }: DailyActivityViewProps) {
  const today = jakartaTodayKey()
  const canMutate = !readOnly

  const [data, setData] = useState<DailyActivityPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Filters
  const [from, setFrom] = useState(() => monthStartKey(today))
  const [to, setTo] = useState(() => monthEndKey(today))
  const [division, setDivision] = useState('')
  const [executionStatus, setExecutionStatus] = useState('')
  const [priorityLevel, setPriorityLevel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [scope, setScope] = useState<ScopeMode>('all')

  const [activeTab, setActiveTab] = useState<TabKey>('workspace')
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null)

  // Modals
  const [planOpen, setPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState({
    activityDate: today,
    title: '',
    detail: '',
    location: '',
    target: '',
    priorityLevel: 'MEDIUM' as DailyActivityPriorityLevel,
  })
  const [planSubmitting, setPlanSubmitting] = useState(false)

  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteDate, setPasteDate] = useState(today)
  const [pasteText, setPasteText] = useState('')
  const [pasteSubmitting, setPasteSubmitting] = useState(false)

  const [updateItem, setUpdateItem] = useState<DailyActivityItemDto | null>(null)
  const [updateForm, setUpdateForm] = useState<{
    executionStatus: DailyActivityExecutionStatus
    progressPercent: number
    resultNote: string
    obstacleNote: string
  }>({
    executionStatus: 'DONE',
    progressPercent: 100,
    resultNote: '',
    obstacleNote: '',
  })
  const [updateSubmitting, setUpdateSubmitting] = useState(false)

  const [profileForm, setProfileForm] = useState<{
    division: string
    subdivision: string
    planningLevel: DailyActivityPlanningLevel
  }>({ division: DIVISIONS[0], subdivision: getDailyActivitySubdivisions(DIVISIONS[0])[0] ?? '', planningLevel: 'STAFF' })
  const [profileSubmitting, setProfileSubmitting] = useState(false)

  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedKeyword(keyword), 300)
    return () => clearTimeout(handler)
  }, [keyword])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (division) params.set('division', division)
      if (executionStatus) params.set('executionStatus', executionStatus)
      if (priorityLevel) params.set('priorityLevel', priorityLevel)
      if (debouncedKeyword) params.set('keyword', debouncedKeyword)
      params.set('scope', scope)

      const res = await fetch(`/api/daily-activity?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Gagal memuat data Daily Activity')
      }
      const payload = (await res.json()) as DailyActivityPageData
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data Daily Activity')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, division, executionStatus, priorityLevel, debouncedKeyword, scope])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setProfileForm({
      division: data?.profile.division ?? DIVISIONS[0],
      subdivision: data?.profile.subdivision ?? getDailyActivitySubdivisions(data?.profile.division ?? DIVISIONS[0])[0] ?? '',
      planningLevel: data?.profile.planningLevel ?? 'STAFF',
    })
  }, [
    data?.profile.division,
    data?.profile.subdivision,
    data?.profile.planningLevel,
    data?.profile.updatedAt,
  ])

  const items = data?.items ?? []
  const scopeData = data?.scope ?? null
  const usersCount = data?.users.length ?? 0

  const groupedItems = useMemo(() => {
    const map = new Map<string, DailyActivityItemDto[]>()
    for (const item of data?.items ?? []) {
      const bucket = map.get(item.dateKey)
      if (bucket) bucket.push(item)
      else map.set(item.dateKey, [item])
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [data?.items])

  const calendarMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    for (const day of data?.calendar ?? []) map.set(day.dateKey, { total: day.total, done: day.done })
    return map
  }, [data?.calendar])

  const resetFilters = () => {
    setFrom(monthStartKey(today))
    setTo(monthEndKey(today))
    setDivision('')
    setExecutionStatus('')
    setPriorityLevel('')
    setKeyword('')
    setDebouncedKeyword('')
    setScope('all')
  }

  const handleOpenPlan = () => {
    if (!canMutate) return
    setPlanForm({ activityDate: today, title: '', detail: '', location: '', target: '', priorityLevel: 'MEDIUM' })
    setError('')
    setPlanOpen(true)
  }

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canMutate || planSubmitting) return
    const title = planForm.title.trim()
    if (!title) {
      setError('Judul aktivitas wajib diisi')
      return
    }
    setPlanSubmitting(true)
    try {
      const res = await fetch('/api/daily-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              activityDate: planForm.activityDate,
              title,
              detail: planForm.detail.trim(),
              location: planForm.location.trim(),
              target: planForm.target.trim(),
              priorityLevel: planForm.priorityLevel,
            },
          ],
        }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Gagal menyimpan aktivitas')
      }
      setPlanOpen(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan aktivitas')
    } finally {
      setPlanSubmitting(false)
    }
  }

  const handleOpenPaste = () => {
    if (!canMutate) return
    setPasteDate(today)
    setPasteText('')
    setError('')
    setPasteOpen(true)
  }

  const parsedPaste = useMemo(() => parseSmartPaste(pasteText), [pasteText])

  const handleSubmitPaste = async () => {
    if (!canMutate || pasteSubmitting) return
    if (parsedPaste.length === 0) {
      setError('Tidak ada baris valid untuk disimpan')
      return
    }
    setPasteSubmitting(true)
    try {
      const res = await fetch('/api/daily-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: parsedPaste.map((row) => ({
            activityDate: pasteDate,
            title: row.title,
            location: row.location,
            target: row.target,
            priorityLevel: row.priorityLevel,
          })),
        }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Gagal menyimpan aktivitas')
      }
      setPasteOpen(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan aktivitas')
    } finally {
      setPasteSubmitting(false)
    }
  }

  const handleOpenUpdate = (item: DailyActivityItemDto) => {
    if (!canMutate) return
    setUpdateItem(item)
    setUpdateForm({
      executionStatus: item.executionStatus,
      progressPercent: item.progressPercent,
      resultNote: item.resultNote ?? '',
      obstacleNote: item.obstacleNote ?? '',
    })
    setError('')
  }

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canMutate || !updateItem || updateSubmitting) return
    setUpdateSubmitting(true)
    try {
      const res = await fetch(`/api/daily-activity/${updateItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionStatus: updateForm.executionStatus,
          progressPercent: updateForm.progressPercent,
          resultNote: updateForm.resultNote.trim(),
          obstacleNote: updateForm.obstacleNote.trim(),
        }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Gagal memperbarui aktivitas')
      }
      setUpdateItem(null)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui aktivitas')
    } finally {
      setUpdateSubmitting(false)
    }
  }

  const handleDelete = async (item: DailyActivityItemDto) => {
    if (!canMutate) return
    if (!window.confirm(`Hapus aktivitas "${item.title}"?`)) return
    try {
      const res = await fetch(`/api/daily-activity/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Gagal menghapus aktivitas')
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus aktivitas')
    }
  }

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canMutate || profileSubmitting) return
    setProfileSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/daily-activity/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          division: profileForm.division,
          subdivision: profileForm.subdivision,
          planningLevel: profileForm.planningLevel,
        }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Gagal menyimpan profil')
      }
      setNotice('Profil divisi berhasil disimpan')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan profil')
    } finally {
      setProfileSubmitting(false)
    }
  }

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const XLSX = await import('xlsx')
      const rows = items.map((item) => ({
        Kode: item.code,
        Tanggal: item.dateKey,
        Nama: item.ownerName,
        Divisi: item.division,
        Subdivisi: item.subdivision ?? '',
        Level: item.planningLevel,
        Judul: item.title,
        Prioritas: DAILY_ACTIVITY_PRIORITY_LABELS[item.priorityLevel],
        Status: DAILY_ACTIVITY_EXECUTION_STATUS_LABELS[item.executionStatus],
        Progres: `${item.progressPercent}%`,
        Lokasi: item.location ?? '',
        Target: item.target ?? '',
        Hasil: item.resultNote ?? '',
        Kendala: item.obstacleNote ?? '',
      }))
      const worksheet =
        rows.length > 0
          ? XLSX.utils.json_to_sheet(rows)
          : XLSX.utils.aoa_to_sheet([['Tidak ada data']])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Activity')
      XLSX.writeFile(workbook, `Daily-Activity-${jakartaTodayKey()}.xlsx`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal export data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopySummary = async () => {
    const lines = items.map(
      (item) =>
        `${item.dateKey}\t${item.ownerName}\t${item.title}\t${DAILY_ACTIVITY_EXECUTION_STATUS_LABELS[item.executionStatus]}\t${item.progressPercent}%`
    )
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Gagal menyalin ringkasan')
    }
  }

  const tabs: { key: TabKey; label: string; icon: LucideIcon; badge?: number }[] = [
    { key: 'workspace', label: 'Workspace', icon: ClipboardList },
    { key: 'performance', label: 'Performa', icon: BarChart2 },
    { key: 'calendar', label: 'Kalender', icon: Calendar },
    { key: 'profile', label: 'Profil Divisi', icon: UserCog },
  ]

  const summary = data?.summary

  return (
    <div className="space-y-4">
      {/* Toolbar + Filter */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenPlan}
            disabled={!canMutate}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:flex-none"
          >
            <Plus className="h-4 w-4" />
            Rencana Aktivitas
          </button>
          <button
            type="button"
            onClick={handleOpenPaste}
            disabled={!canMutate}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 sm:flex-none"
          >
            <ClipboardPaste className="h-4 w-4" />
            Smart Paste
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || items.length === 0}
            className="hidden items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 md:flex"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Menyiapkan...' : 'Export Excel'}
          </button>
          <button
            type="button"
            onClick={handleCopySummary}
            disabled={items.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 sm:flex-none"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Tersalin' : 'Salin Ringkasan'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className={LABEL_CLASS}>Dari Tanggal</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Sampai Tanggal</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div className="hidden md:block">
            <label className={LABEL_CLASS}>Divisi</label>
            <select value={division} onChange={(e) => setDivision(e.target.value)} className={INPUT_CLASS}>
              <option value="">Semua Divisi</option>
              {DIVISIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Status Pelaksanaan</label>
            <select value={executionStatus} onChange={(e) => setExecutionStatus(e.target.value)} className={INPUT_CLASS}>
              <option value="">Semua Status</option>
              {DAILY_ACTIVITY_EXECUTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {DAILY_ACTIVITY_EXECUTION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Prioritas</label>
            <select value={priorityLevel} onChange={(e) => setPriorityLevel(e.target.value)} className={INPUT_CLASS}>
              <option value="">Semua Prioritas</option>
              {DAILY_ACTIVITY_PRIORITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {DAILY_ACTIVITY_PRIORITY_LABELS[level]}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={LABEL_CLASS}>Kata Kunci</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Judul / lokasi / kode..."
                className={clsx(INPUT_CLASS, 'pl-9')}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value as ScopeMode)} className={INPUT_CLASS}>
              <option value="all">Semua</option>
              <option value="mine">Milik Saya</option>
              {(scopeData?.isApprover || scopeData?.isAdmin) && <option value="team">Tim Divisi</option>}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {summary ? `${summary.total} aktivitas · ${summary.done} selesai · rata-rata progres ${summary.progressAvg}%` : '-'}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filter
          </button>
        </div>
      </div>

      {readOnly && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          Role Anda hanya dapat melihat Daily Activity tanpa menambah, mengubah, atau menghapus.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          {notice}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex flex-shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all sm:text-sm',
                active
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Workspace */}
      {activeTab === 'workspace' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : groupedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800">
              <ClipboardList className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">Belum ada aktivitas</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sesuaikan filter atau tambahkan rencana aktivitas baru.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block">
                <table className="w-full table-fixed">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Kode</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Aktivitas</th>
                      <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Status</th>
                      <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Progres</th>
                      <th className="w-[15%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {groupedItems.map(([dateKey, group]) => (
                      <Fragment key={dateKey}>
                        <tr className="bg-gray-50 dark:bg-gray-900">
                          <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                            {formatDateLabel(dateKey)} · {group.length} aktivitas
                          </td>
                        </tr>
                        {group.map((item) => (
                          <tr key={item.id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-700/40">
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{item.code}</div>
                              <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{item.ownerName}</div>
                              <div className="text-[11px] text-gray-400 dark:text-gray-500">
                                {item.division}
                                {item.subdivision ? ` / ${item.subdivision}` : ''}
                              </div>
                              <div className="mt-1">
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                  {item.planningLevel}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={priorityBadgeClass(item.priorityLevel)}>
                                  {DAILY_ACTIVITY_PRIORITY_LABELS[item.priorityLevel]}
                                </span>
                              </div>
                              {(item.location || item.target) && (
                                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                  {item.location && <span>Lokasi: {item.location}</span>}
                                  {item.location && item.target && ' · '}
                                  {item.target && <span>Target: {item.target}</span>}
                                </div>
                              )}
                              {item.detail && (
                                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{item.detail}</div>
                              )}
                              {item.resultNote && (
                                <div className="mt-1 text-[11px] text-green-600 dark:text-green-400">Hasil: {item.resultNote}</div>
                              )}
                              {item.obstacleNote && (
                                <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Kendala: {item.obstacleNote}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={executionBadgeClass(item.executionStatus)}>
                                {DAILY_ACTIVITY_EXECUTION_STATUS_LABELS[item.executionStatus]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                <div
                                  className={clsx('h-full rounded-full', progressBarClass(item.executionStatus))}
                                  style={{ width: `${item.progressPercent}%` }}
                                />
                              </div>
                              <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{item.progressPercent}%</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-center gap-1">
                                {canMutate && scopeData && canEditItem(scopeData, item) && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenUpdate(item)}
                                      className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                                    >
                                      <Pencil className="h-3 w-3" />
                                      Update
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(item)}
                                      className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Hapus
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {groupedItems.map(([dateKey, group]) => (
                  <div key={dateKey} className="space-y-2">
                    <div className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {formatDateLabel(dateKey)} · {group.length}
                    </div>
                    {group.map((item) => {
                      const expanded = expandedItemId === item.id
                      return (
                        <div key={item.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                          <button
                            type="button"
                            onClick={() => setExpandedItemId(expanded ? null : item.id)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {expanded ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />}
                                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={executionBadgeClass(item.executionStatus)}>
                                  {DAILY_ACTIVITY_EXECUTION_STATUS_LABELS[item.executionStatus]}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">{item.progressPercent}%</span>
                                <span className="text-[11px] text-gray-400 dark:text-gray-500">{item.ownerName}</span>
                              </div>
                            </div>
                          </button>
                          {expanded && (
                            <div className="space-y-2 border-t border-gray-100 px-3 py-3 dark:border-gray-700">
                              <div className="flex flex-wrap gap-1.5">
                                <span className={priorityBadgeClass(item.priorityLevel)}>
                                  {DAILY_ACTIVITY_PRIORITY_LABELS[item.priorityLevel]}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {item.code} · {item.division}
                                {item.subdivision ? ` / ${item.subdivision}` : ''} · {item.planningLevel}
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                <div className={clsx('h-full rounded-full', progressBarClass(item.executionStatus))} style={{ width: `${item.progressPercent}%` }} />
                              </div>
                              {(item.location || item.target) && (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {item.location && <span>Lokasi: {item.location}</span>}
                                  {item.location && item.target && ' · '}
                                  {item.target && <span>Target: {item.target}</span>}
                                </div>
                              )}
                              {item.resultNote && <div className="text-[11px] text-green-600 dark:text-green-400">Hasil: {item.resultNote}</div>}
                              {item.obstacleNote && <div className="text-[11px] text-amber-600 dark:text-amber-400">Kendala: {item.obstacleNote}</div>}
                              <div className="flex flex-wrap gap-2 pt-1">
                                {canMutate && scopeData && canEditItem(scopeData, item) && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenUpdate(item)}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Update
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(item)}
                                      className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 dark:border-red-900 dark:text-red-300"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Hapus
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Performance */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          {(['daily', 'weekly', 'monthly'] as const).map((bucketKey) => {
            const title = bucketKey === 'daily' ? 'Performa Harian' : bucketKey === 'weekly' ? 'Performa Mingguan' : 'Performa Bulanan'
            const rows = data?.performance[bucketKey] ?? []
            return (
              <div key={bucketKey} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                    <BarChart2 className="h-4 w-4 text-gray-500" />
                    {title}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Periode</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Total</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Direncanakan</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Selesai</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Tertunda</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">Rata-rata Progres</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">Memuat data...</td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">Tidak ada data</td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                            <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">{row.label}</td>
                            <td className="px-4 py-2 text-center text-sm text-gray-800 dark:text-gray-200">{row.total}</td>
                            <td className="px-4 py-2 text-center text-sm text-gray-600 dark:text-gray-300">{row.planned}</td>
                            <td className="px-4 py-2 text-center text-sm text-green-600 dark:text-green-400">{row.done}</td>
                            <td className="px-4 py-2 text-center text-sm text-amber-600 dark:text-amber-400">{row.pending}</td>
                            <td className="px-4 py-2 text-center text-sm text-gray-800 dark:text-gray-200">{row.progressAvg}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Calendar */}
      {activeTab === 'calendar' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {(() => {
            const monthKey = (from || today).slice(0, 7)
            const monthAnchor = parseDateKey(`${monthKey}-01`)
            const gridStart = startOfWeek(monthAnchor, { weekStartsOn: 1 })
            const gridEnd = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 })
            const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
            const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
            return (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    {format(monthAnchor, 'MMMM yyyy', { locale: idLocale })}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Klik tanggal untuk memfilter</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weekdays.map((day) => (
                    <div key={day} className="py-1 text-center text-[11px] font-semibold uppercase text-gray-400">
                      {day}
                    </div>
                  ))}
                  {days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd')
                    const info = calendarMap.get(key)
                    const inMonth = format(day, 'yyyy-MM') === monthKey
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setFrom(key)
                          setTo(key)
                        }}
                        className={clsx(
                          'flex min-h-[68px] flex-col items-start gap-1 rounded-lg border p-2 text-left transition-colors',
                          inMonth
                            ? 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
                            : 'border-transparent bg-gray-50 text-gray-400 dark:bg-gray-900',
                          key === from && key === to && 'ring-2 ring-blue-500'
                        )}
                      >
                        <span className={clsx('text-xs font-semibold', inMonth ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400')}>
                          {format(day, 'd')}
                        </span>
                        {info && (
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {info.total}/{info.done}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Profile */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
              <UserCog className="h-4 w-4 text-gray-500" />
              Profil Divisi
            </h3>
            <form onSubmit={handleSubmitProfile} className="space-y-3">
              <div>
                <label className={LABEL_CLASS}>Divisi</label>
                <select
                  value={profileForm.division}
                  disabled={!canMutate}
                  onChange={(e) => {
                    const nextDivision = e.target.value
                    setProfileForm((prev) => ({
                      ...prev,
                      division: nextDivision,
                      subdivision: getDailyActivitySubdivisions(nextDivision)[0] ?? '',
                    }))
                  }}
                  className={INPUT_CLASS}
                >
                  {DIVISIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Subdivisi</label>
                <select
                  value={profileForm.subdivision}
                  disabled={!canMutate}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, subdivision: e.target.value }))}
                  className={INPUT_CLASS}
                >
                  <option value="">- Pilih Subdivisi -</option>
                  {getDailyActivitySubdivisions(profileForm.division).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Level Perencanaan</label>
                <select
                  value={profileForm.planningLevel}
                  disabled={!canMutate}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, planningLevel: e.target.value as DailyActivityPlanningLevel }))
                  }
                  className={INPUT_CLASS}
                >
                  {DAILY_ACTIVITY_PLANNING_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={!canMutate || profileSubmitting}
                className="flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                {profileSubmitting ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                <Users className="h-4 w-4 text-gray-500" />
                Scope Saat Ini
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">Pengguna</dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-200">
                    {userName} ({userRole})
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">Divisi</dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-200">{scopeData?.division ?? '-'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">Subdivisi</dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-200">{scopeData?.subdivision ?? '-'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">Level</dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-200">{scopeData?.planningLevel ?? '-'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">Total Pengguna</dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-200">{usersCount}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              <p className="font-semibold">Alur Pengisian</p>
              <p className="mt-1 leading-relaxed">
                Karyawan mengisi <span className="font-semibold">rencana aktivitas</span> pada pagi hari, lalu melengkapi{' '}
                <span className="font-semibold">status dan catatan hasil</span> pada sore hari melalui tombol Update.
                Tahap persetujuan (approval) sedang tidak diaktifkan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {planOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rencana Aktivitas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tambahkan rencana aktivitas harian.</p>
              </div>
              <button type="button" onClick={() => setPlanOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitPlan} className="space-y-4 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Tanggal Aktivitas</label>
                  <input
                    type="date"
                    required
                    value={planForm.activityDate}
                    onChange={(e) => setPlanForm({ ...planForm, activityDate: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Prioritas</label>
                  <select
                    value={planForm.priorityLevel}
                    onChange={(e) => setPlanForm({ ...planForm, priorityLevel: e.target.value as DailyActivityPriorityLevel })}
                    className={INPUT_CLASS}
                  >
                    {DAILY_ACTIVITY_PRIORITY_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {DAILY_ACTIVITY_PRIORITY_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>Judul</label>
                <input
                  type="text"
                  required
                  value={planForm.title}
                  onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                  placeholder="Judul aktivitas..."
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Detail</label>
                <textarea
                  rows={2}
                  value={planForm.detail}
                  onChange={(e) => setPlanForm({ ...planForm, detail: e.target.value })}
                  placeholder="Deskripsi aktivitas (opsional)"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Lokasi</label>
                  <input
                    type="text"
                    value={planForm.location}
                    onChange={(e) => setPlanForm({ ...planForm, location: e.target.value })}
                    placeholder="Lokasi (opsional)"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Target</label>
                  <input
                    type="text"
                    value={planForm.target}
                    onChange={(e) => setPlanForm({ ...planForm, target: e.target.value })}
                    placeholder="Target (opsional)"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setPlanOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={planSubmitting}
                  className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {planSubmitting ? 'Menyimpan...' : 'Simpan Aktivitas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Paste Modal */}
      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smart Paste</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Format tiap baris: Judul | Lokasi | Target | PRIORITAS (pemisah | atau TAB). Baris # diabaikan.
                </p>
              </div>
              <button type="button" onClick={() => setPasteOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Tanggal Aktivitas</label>
                  <input type="date" value={pasteDate} onChange={(e) => setPasteDate(e.target.value)} className={INPUT_CLASS} />
                </div>
                <div className="flex items-end">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {parsedPaste.length} baris valid dari input
                  </span>
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>Tempel Data</label>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'Kunjungan pelanggan | Jl. Merdeka | 3 pelanggan | HIGH\n# baris komentar diabaikan\nFollow up tagihan | Kantor | 5 tagihan'}
                  className={clsx(INPUT_CLASS, 'font-mono text-xs')}
                />
              </div>
              {parsedPaste.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">Judul</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">Lokasi</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">Target</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-300">Prioritas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {parsedPaste.map((row, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-xs text-gray-800 dark:text-gray-200">{row.title}</td>
                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{row.location || '-'}</td>
                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{row.target || '-'}</td>
                            <td className="px-3 py-2 text-xs">
                              <span className={priorityBadgeClass(row.priorityLevel)}>
                                {DAILY_ACTIVITY_PRIORITY_LABELS[row.priorityLevel]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitPaste}
                disabled={pasteSubmitting || parsedPaste.length === 0}
                className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                {pasteSubmitting ? 'Menyimpan...' : `Simpan ${parsedPaste.length} Aktivitas`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {updateItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Update Aktivitas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{updateItem.title}</p>
              </div>
              <button type="button" onClick={() => setUpdateItem(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitUpdate} className="space-y-4 overflow-y-auto p-4 sm:p-6">
              <div>
                <label className={LABEL_CLASS}>Status Pelaksanaan</label>
                <select
                  value={updateForm.executionStatus}
                  onChange={(e) => {
                    const nextStatus = e.target.value as DailyActivityExecutionStatus
                    setUpdateForm((prev) => ({
                      ...prev,
                      executionStatus: nextStatus,
                      progressPercent: nextStatus === 'DONE' ? 100 : nextStatus === 'PLANNED' ? 0 : prev.progressPercent,
                    }))
                  }}
                  className={INPUT_CLASS}
                >
                  {DAILY_ACTIVITY_EXECUTION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {DAILY_ACTIVITY_EXECUTION_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Progres ({updateForm.progressPercent}%)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={updateForm.progressPercent}
                    disabled={updateForm.executionStatus === 'DONE' || updateForm.executionStatus === 'PLANNED'}
                    onChange={(e) => setUpdateForm((prev) => ({ ...prev, progressPercent: Number(e.target.value) }))}
                    className="h-2 flex-1 cursor-pointer accent-blue-600 disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={updateForm.progressPercent}
                    disabled={updateForm.executionStatus === 'DONE' || updateForm.executionStatus === 'PLANNED'}
                    onChange={(e) =>
                      setUpdateForm((prev) => ({
                        ...prev,
                        progressPercent: Math.max(0, Math.min(100, Number(e.target.value))),
                      }))
                    }
                    className={clsx(INPUT_CLASS, 'w-20')}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>Catatan Hasil</label>
                <textarea
                  rows={2}
                  value={updateForm.resultNote}
                  onChange={(e) => setUpdateForm((prev) => ({ ...prev, resultNote: e.target.value }))}
                  placeholder="Hasil pelaksanaan (opsional)"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Catatan Kendala</label>
                <textarea
                  rows={2}
                  value={updateForm.obstacleNote}
                  onChange={(e) => setUpdateForm((prev) => ({ ...prev, obstacleNote: e.target.value }))}
                  placeholder="Kendala yang dihadapi (opsional)"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setUpdateItem(null)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updateSubmitting}
                  className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {updateSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
