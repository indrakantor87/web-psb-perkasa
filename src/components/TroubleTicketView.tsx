'use client'

import { Fragment, useEffect, useMemo, useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Pencil, CheckCircle2, Clipboard, X, Trash2, Info, ArrowUp, AlertTriangle, ArrowRight } from 'lucide-react'
import NextImage from 'next/image'
import { useRouter } from 'next/navigation'

type TroubleTicketRow = {
  id: number
  ticketCode: string | null
  ticketPrefix: string | null
  ticketNumber: number | null
  category?: 'TT' | 'PV' | string | null
  customerName: string
  user: string | null
  waNumber: string
  mapsUrl: string | null
  type: string
  openedAt: string
  closedAt: string | null
  notes: string | null
  problemCategory?: string | null
  resolutionAction?: string | null
  closeNotes?: string | null
  closePhotos?: string[] | null
  closePhotoUrls?: string[] | null
  closePhotosCount?: number | null
  closeBy?: string | null
  status: string
}

type TroubleTicketCreatePayload = {
  category: 'TT' | 'PV'
  ticketCode: string
  customerName: string
  user: string
  waNumber: string
  mapsUrl: string
  type: string
  notes: string
  problemCategory: string
}

type TroubleTicketEditPayload = {
  customerName: string
  user: string
  waNumber: string
  mapsUrl: string
  type: string
  problemCategory: string
  status: 'OPEN' | 'CLOSE'
  notes: string
}

const DEFAULT_PROBLEM_CATEGORIES = [
  'LOSS/LOS',
  'NO INTERNET',
  'PUTUS-NYAMBUNG',
  'LEMOT',
  'HIGH LATENCY',
  'PACKET LOSS',
  'MODEM/ONT',
  'ROUTER/WIFI',
  'ADAPTOR/POWER',
  'KABEL/DROPCORE',
  'ODP/PORT',
  'KONFIGURASI/PPPOE',
  'LAINNYA',
] as const

const DEFAULT_SLA_DAYS: Record<string, number> = { EMERGENCY: 2, MAJOR: 3, MINOR: 5, PREVENTIVE: 30 }

function normalizeCategory(input: unknown) {
  const c = String(input ?? '').trim().toUpperCase()
  if (c === 'PV') return 'PV'
  return 'TT'
}

function normalizeTypeKey(type: unknown) {
  return String(type ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
}

function formatTypeLabel(type: unknown) {
  const t = normalizeTypeKey(type)
  if (!t) return '-'
  return t
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatDurationMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  return `${days}D:${hours}H:${minutes}M`
}

function formatOverdueShort(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}H ${hours}J`
  if (hours > 0) return `${hours}J ${minutes}M`
  return `${minutes}M`
}

function formatTicketNumber(n: number) {
  return String(n).padStart(2, '0')
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatDateForTicketId(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`
}

function formatWaDisplay(value: string) {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return value || '-'
  if (digits.startsWith('0')) return `+62 ${digits.slice(1)}`
  if (digits.startsWith('62')) return `+${digits}`
  return `+${digits}`
}

function buildTicketDetailText(row: TroubleTicketRow) {
  const code = row.ticketCode || String(row.id)
  const datePart = formatDateForTicketId(row.openedAt)
  const ticketId = datePart ? `${code}/${datePart}` : code
  const maps = (row.mapsUrl || '').trim()
  const type = formatTypeLabel(row.type)
  const status = ((row.status || '').toLowerCase() === 'close' || row.closedAt) ? 'close' : 'open'
  const isClosed = status === 'close'
  const penanganan = (row.closeNotes || '').trim()
  const hasPhotos = Array.isArray(row.closePhotos)
    ? row.closePhotos.length > 0
    : Number(row.closePhotosCount || 0) > 0
  const closeBy = (row.closeBy || '').trim()

  const lines = [
    `ID TICKET : ${ticketId}`,
    `Nama\t: ${(row.customerName || '').trim() || '-'}`,
    `User\t: ${(row.user || '').trim() || '-'}`,
    `No WA : ${formatWaDisplay(row.waNumber)}`,
    `In Maps\t: ${maps ? `\`${maps}\`` : '-'}`,
    `Type : ${type}`,
    `Gangguan : ${(row.problemCategory || '').trim() || '-'}`,
    `Tindakan : ${(row.resolutionAction || '').trim() || '-'}`,
    `Keterangan : ${(row.notes || '').trim() || '-'}`,
    ...(isClosed ? [`Penanganan : ${penanganan || '-'}`] : []),
    ...(isClosed ? [`View : ${hasPhotos ? 'Ada foto' : '-'}`] : []),
    ...(isClosed ? [`Close By : ${closeBy || '-'}`] : []),
    `Status : ${status}`,
  ]

  return lines.join('\n')
}

function getTroubleshootsTypeMeta(type: string) {
  const t = normalizeTypeKey(type)
  if (t === 'EMERGENCY') return { label: 'TT_EM', Icon: ArrowUp, iconClass: 'text-red-500' }
  if (t === 'MAJOR') return { label: 'TT_MA', Icon: AlertTriangle, iconClass: 'text-yellow-500' }
  if (t === 'MINOR') return { label: 'TT_MI', Icon: ArrowRight, iconClass: 'text-green-500' }
  if (t === 'PREVENTIVE') return { label: 'PV', Icon: ArrowRight, iconClass: 'text-blue-500' }
  return { label: `TT_${t || 'NA'}`, Icon: AlertTriangle, iconClass: 'text-gray-400' }
}

function normalizeWaNumber(input: string) {
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  return digits
}

function normalizeMapsLink(input: string) {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const coord = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (coord) return `https://www.google.com/maps?q=${coord[1]},${coord[2]}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`
}

function formatExcelDate(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseExcelDate(v: unknown) {
  if (!v) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  if (!s) return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (m) {
    const day = parseInt(m[1], 10)
    const month = parseInt(m[2], 10) - 1
    const year = parseInt(m[3], 10)
    const hour = m[4] ? parseInt(m[4], 10) : 0
    const minute = m[5] ? parseInt(m[5], 10) : 0
    const d = new Date(year, month, day, hour, minute)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function normalizeHeader(s: unknown) {
  return String(s ?? '').trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ')
}

export function TroubleTicketView({ userRole }: { userRole: string }) {
  const router = useRouter()
  const nowDate = new Date()
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  const years = [2024, 2025, 2026, 2027]

  const [rows, setRows] = useState<TroubleTicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(nowDate.getMonth() + 1)
  const [year, setYear] = useState(nowDate.getFullYear())
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'CLOSE' | 'OVERDUE'>(
    (userRole || '').toUpperCase() === 'TROUBLESHOOTS' ? 'OPEN' : 'ALL'
  )
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [summaryRemote, setSummaryRemote] = useState<{ open: number; close: number; overdue: number }>({ open: 0, close: 0, overdue: 0 })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [detailRow, setDetailRow] = useState<TroubleTicketRow | null>(null)
  const [detailFetching, setDetailFetching] = useState(false)
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false)
  const [closeByMap, setCloseByMap] = useState<Record<number, string | null>>({})
  const [closeByLoadingId, setCloseByLoadingId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const [form, setForm] = useState<TroubleTicketCreatePayload>({
    category: 'TT',
    ticketCode: '',
    customerName: '',
    user: '',
    waNumber: '',
    mapsUrl: '',
    type: '',
    notes: '',
    problemCategory: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingCategory, setEditingCategory] = useState<'TT' | 'PV'>('TT')
  const [editForm, setEditForm] = useState<TroubleTicketEditPayload>({
    customerName: '',
    user: '',
    waNumber: '',
    mapsUrl: '',
    type: '',
    problemCategory: '',
    status: 'OPEN',
    notes: '',
  })
  const [slaDays, setSlaDays] = useState<Record<string, number>>(DEFAULT_SLA_DAYS)
  const [slaTypes, setSlaTypes] = useState<string[]>(Object.keys(DEFAULT_SLA_DAYS))
  const [problemOptions, setProblemOptions] = useState<string[]>([...DEFAULT_PROBLEM_CATEGORIES])
  const [idPrefix, setIdPrefix] = useState('TT/PKN/')
  const [nextNumber, setNextNumber] = useState(1)

  const roleUpper = (userRole || '').toUpperCase()
  const isTroubleshoots = roleUpper === 'TROUBLESHOOTS'
  const canCreate = useMemo(() => ['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(roleUpper), [roleUpper])
  const canDelete = useMemo(() => ['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(roleUpper), [roleUpper])
  const isPrivileged = useMemo(() => ['ADMIN', 'CS', 'NOC'].includes(roleUpper), [roleUpper])

  const fileInputId = 'trouble-ticket-import-input'

  useEffect(() => {
    if (!isTroubleshoots) return
    if (status !== 'OPEN' && status !== 'CLOSE') setStatus('OPEN')
  }, [isTroubleshoots, status])

  useEffect(() => {
    if (isTroubleshoots) return
    setPage(1)
  }, [isTroubleshoots, month, year, status, debouncedSearch, pageSize])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/trouble-tickets/master?kind=PROBLEM_CATEGORY', { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as unknown
        if (!res.ok) return
        const rows = Array.isArray(data) ? (data as Array<{ value?: unknown }>) : []
        const values = rows
          .map((r) => String(r?.value ?? '').trim())
          .filter(Boolean)
        if (values.length) setProblemOptions(values)
      } catch {}
    })()
    return () => controller.abort()
  }, [])

  const fetchRows = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const nowMs = Date.now()
      const params = new URLSearchParams()
      if (!isTroubleshoots) {
        params.set('month', String(month))
        params.set('year', String(year))
        params.set('limit', String(pageSize))
        params.set('page', String(page))
      } else {
        params.set('limit', status === 'CLOSE' ? '120' : '200')
      }
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      if (!isTroubleshoots && status === 'OVERDUE') params.set('overdue', '1')
      if (status !== 'ALL') params.set('status', status === 'OVERDUE' ? 'OPEN' : status)
      const res = await fetch(`/api/trouble-tickets?${params.toString()}`, { signal })
      const data = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) {
        const msg = (data as { error?: string })?.error || 'Gagal memuat data'
        throw new Error(msg)
      }
      const nextRows = (isTroubleshoots
        ? (Array.isArray(data) ? data : [])
        : (Array.isArray((data as { items?: unknown }).items) ? (data as { items: unknown[] }).items : [])) as TroubleTicketRow[]
      if (!isTroubleshoots) {
        const t = Math.trunc(Number((data as { total?: unknown }).total))
        setTotal(Number.isFinite(t) && t >= 0 ? t : 0)
        const s = (data as { summary?: { open?: unknown; close?: unknown; overdue?: unknown } }).summary
        setSummaryRemote({
          open: Math.trunc(Number(s?.open ?? 0)) || 0,
          close: Math.trunc(Number(s?.close ?? 0)) || 0,
          overdue: Math.trunc(Number(s?.overdue ?? 0)) || 0,
        })
      }
      setRows(
        isTroubleshoots
          ? nextRows.filter((r) => {
              const isClosed = (r.status || '').toUpperCase() === 'CLOSE' || !!r.closedAt
              if (status === 'CLOSE') return isClosed
              if (isClosed) return false
              if (status !== 'OVERDUE') return true
              const t = new Date(r.openedAt).getTime()
              const days = slaDays[normalizeTypeKey(r.type)] ?? 1
              const limitMs = days * 24 * 60 * 60 * 1000
              return Number.isFinite(t) && nowMs - t > limitMs
            })
          : status === 'OVERDUE'
            ? nextRows
            : nextRows
      )
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, isTroubleshoots, month, page, pageSize, slaDays, status, year])

  useEffect(() => {
    const controller = new AbortController()
    fetchRows(controller.signal)
    return () => controller.abort()
  }, [fetchRows])

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/trouble-tickets/master?kind=PROBLEM_CATEGORY', { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as unknown
        if (!res.ok) return
        const rows = Array.isArray(data) ? (data as Array<{ value?: unknown }>) : []
        const values = rows
          .map((r) => String(r?.value ?? '').trim())
          .filter(Boolean)
        if (values.length) setProblemOptions(values)
      } catch {}
    })()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/trouble-ticket-sla', { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as unknown
        if (!res.ok) return
        const rows = Array.isArray(data) ? (data as Array<{ type?: unknown; durationDays?: unknown }>) : []
        const map: Record<string, number> = { ...DEFAULT_SLA_DAYS }
        const types = new Set<string>(Object.keys(DEFAULT_SLA_DAYS))
        for (const r of rows) {
          const t = normalizeTypeKey(r.type)
          const n = Math.trunc(Number(r.durationDays))
          if (!t || !Number.isFinite(n) || n < 1) continue
          map[t] = n
          types.add(t)
        }
        setSlaDays(map)
        setSlaTypes(Array.from(types).sort((a, b) => formatTypeLabel(a).localeCompare(formatTypeLabel(b))))
      } catch {}
    })()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        if (!canCreate) return
        const res = await fetch(`/api/trouble-ticket-id?month=${month}&year=${year}&category=${form.category}`, { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as { prefix?: unknown; nextNumber?: unknown }
        if (!res.ok) return
        const prefix = String(data.prefix ?? '').trim()
        const n = Math.trunc(Number(data.nextNumber))
        if (prefix) setIdPrefix(prefix.endsWith('/') ? prefix : `${prefix}/`)
        if (Number.isFinite(n) && n > 0) setNextNumber(n)
      } catch {}
    })()
    return () => controller.abort()
  }, [canCreate, form.category, month, year])

  useEffect(() => {
    setForm((prev) => {
      if (prev.category === 'PV') {
        if (normalizeTypeKey(prev.type) !== 'PREVENTIVE') return { ...prev, type: 'PREVENTIVE' }
        return prev
      }
      if (normalizeTypeKey(prev.type) === 'PREVENTIVE') return { ...prev, type: '' }
      return prev
    })
  }, [form.category])

  // Pull to refresh support
  useEffect(() => {
    const handler = (ev: Event) => {
      const customEv = ev as CustomEvent
      const promise = (async () => {
        router.refresh()
        await fetchRows()
      })()
      if (customEv.detail && typeof customEv.detail.register === 'function') {
        customEv.detail.register(promise)
      }
    }
    window.addEventListener('app:refresh', handler)
    return () => window.removeEventListener('app:refresh', handler)
  }, [fetchRows, router])

  const now = Date.now()

  const summary = useMemo(() => {
    if (!isTroubleshoots) return summaryRemote
    let open = 0
    let close = 0
    let overdue = 0
    for (const r of rows) {
      const st = (r.status || '').toUpperCase()
      const isClose = st === 'CLOSE' || !!r.closedAt
      if (isClose) close += 1
      else open += 1

      if (!isClose) {
        const t = new Date(r.openedAt).getTime()
        const typeKey = String(r.type ?? '').trim().toUpperCase().replace(/\s+/g, '_')
        const days = slaDays[typeKey] ?? 1
        const limitMs = days * 24 * 60 * 60 * 1000
        if (Number.isFinite(t) && now - t > limitMs) overdue += 1
      }
    }
    return { open, close, overdue }
  }, [isTroubleshoots, rows, now, slaDays, summaryRemote])

  const pageStart = !isTroubleshoots && total > 0 ? (page - 1) * pageSize + 1 : 0
  const pageEnd = !isTroubleshoots && total > 0 ? Math.min((page - 1) * pageSize + rows.length, total) : 0
  const canPrevPage = !isTroubleshoots && page > 1
  const canNextPage = !isTroubleshoots && pageEnd < total

  const handleCreate = async () => {
    if (!canCreate) return
    setIsSubmitting(true)
    setError(null)
    try {
      const category = form.category
      if (category === 'TT' && !form.problemCategory.trim()) {
        throw new Error('Jenis gangguan wajib dipilih')
      }
      const payload = {
        category,
        ticketCode: form.ticketCode.trim(),
        customerName: form.customerName.trim(),
        user: form.user.trim(),
        waNumber: form.waNumber.trim(),
        mapsUrl: form.mapsUrl.trim(),
        type: normalizeTypeKey(form.type),
        notes: form.notes.trim(),
        problemCategory: form.problemCategory.trim(),
        month,
        year,
      }
      const res = await fetch('/api/trouble-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) {
        const msg = (data as { error?: string })?.error || (data as { message?: string })?.message || 'Gagal membuat ticket'
        throw new Error(msg)
      }
      setIsCreateOpen(false)
      setForm({
        category,
        ticketCode: '',
        customerName: '',
        user: '',
        waNumber: '',
        mapsUrl: '',
        type: '',
        notes: '',
        problemCategory: '',
      })
      try {
        const res2 = await fetch(`/api/trouble-ticket-id?month=${month}&year=${year}&category=${category}`)
        const cfg = (await res2.json().catch(() => ({}))) as { prefix?: unknown; nextNumber?: unknown }
        if (res2.ok) {
          const prefix = String(cfg.prefix ?? '').trim()
          const n = Math.trunc(Number(cfg.nextNumber))
          if (prefix) setIdPrefix(prefix.endsWith('/') ? prefix : `${prefix}/`)
          if (Number.isFinite(n) && n > 0) setNextNumber(n)
        }
      } catch {}
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEdit = (row: TroubleTicketRow) => {
    setEditingId(row.id)
    const inferredCategory =
      normalizeCategory(row.category) === 'PV' ||
      (String(row.ticketCode ?? '').trim().toUpperCase().startsWith('PV/')) ||
      normalizeTypeKey(row.type) === 'PREVENTIVE'
        ? 'PV'
        : 'TT'
    setEditingCategory(inferredCategory)
    setEditForm({
      customerName: row.customerName || '',
      user: row.user || '',
      waNumber: row.waNumber || '',
      mapsUrl: row.mapsUrl || '',
      type: inferredCategory === 'PV' ? 'PREVENTIVE' : normalizeTypeKey(row.type),
      problemCategory: String(row.problemCategory ?? '').trim(),
      status: ((row.status || '').toUpperCase() === 'CLOSE' || row.closedAt) ? 'CLOSE' : 'OPEN',
      notes: row.notes || '',
    })
    setIsEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingId) return
    setIsSubmitting(true)
    setError(null)
    try {
      const typeKey = normalizeTypeKey(editForm.type)
      const normalizedType =
        editingCategory === 'PV'
          ? 'PREVENTIVE'
          : typeKey === 'PREVENTIVE'
            ? (() => {
                throw new Error('Kategori Trouble Ticket tidak bisa memilih type Preventive')
              })()
            : typeKey
      const payload = {
        customerName: editForm.customerName.trim(),
        user: editForm.user.trim(),
        waNumber: editForm.waNumber.trim(),
        mapsUrl: editForm.mapsUrl.trim(),
        type: normalizedType,
        notes: editForm.notes.trim(),
        problemCategory: editForm.problemCategory.trim(),
        status: editForm.status,
      }
      const res = await fetch(`/api/trouble-tickets/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal update ticket')
      setIsEditOpen(false)
      setEditingId(null)
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const detailText = useMemo(() => (detailRow ? buildTicketDetailText(detailRow) : ''), [detailRow])

  const handleCopyDetail = async () => {
    if (!detailText) return
    try {
      await navigator.clipboard.writeText(detailText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setError('Gagal copy ke clipboard')
    }
  }

  const handleShareWa = () => {
    if (!detailText) return
    const url = `https://wa.me/?text=${encodeURIComponent(detailText)}`
    window.open(url, '_blank', 'noreferrer')
  }

  const openDetail = async (row: TroubleTicketRow) => {
    setDetailRow(row)
    setCopied(false)
    const isClosed = (row.status || '').toUpperCase() === 'CLOSE' || !!row.closedAt
    const needsFetch = isClosed && (typeof row.closeNotes === 'undefined' || typeof row.closeBy === 'undefined')
    if (!needsFetch) return

    setDetailFetching(true)
    try {
      const res = await fetch(`/api/trouble-tickets/${row.id}`)
      const data = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) return
      const closeNotes = (data as { closeNotes?: unknown })?.closeNotes
      const closePhotos = (data as { closePhotos?: unknown })?.closePhotos
      const closePhotosCount = (data as { closePhotosCount?: unknown })?.closePhotosCount
      const closeBy = (data as { closeBy?: unknown })?.closeBy
      setDetailRow((prev) => {
        if (!prev || prev.id !== row.id) return prev
        return {
          ...prev,
          closeNotes: typeof closeNotes === 'string' ? closeNotes : closeNotes === null ? null : prev.closeNotes,
          closePhotos: Array.isArray(closePhotos) ? (closePhotos as string[]) : closePhotos === null ? null : prev.closePhotos,
          closePhotosCount:
            Number.isFinite(Number(closePhotosCount)) ? Math.max(0, Math.trunc(Number(closePhotosCount))) : prev.closePhotosCount,
          closeBy: typeof closeBy === 'string' ? closeBy : closeBy === null ? null : prev.closeBy,
        }
      })
    } finally {
      setDetailFetching(false)
    }
  }

  const ensureDetailPhotos = async (id: number) => {
    setDetailFetching(true)
    try {
      const res = await fetch(`/api/trouble-tickets/${id}?includePhotos=1`)
      const data = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) return
      const closePhotos = (data as { closePhotos?: unknown })?.closePhotos
      const closePhotoUrls = (data as { closePhotoUrls?: unknown })?.closePhotoUrls
      const closePhotosCount = (data as { closePhotosCount?: unknown })?.closePhotosCount
      setDetailRow((prev) => {
        if (!prev || prev.id !== id) return prev
        return {
          ...prev,
          closePhotos: Array.isArray(closePhotos) ? (closePhotos as string[]) : prev.closePhotos,
          closePhotoUrls: Array.isArray(closePhotoUrls) ? (closePhotoUrls as string[]) : prev.closePhotoUrls,
          closePhotosCount:
            Number.isFinite(Number(closePhotosCount)) ? Math.max(0, Math.trunc(Number(closePhotosCount))) : prev.closePhotosCount,
        }
      })
    } finally {
      setDetailFetching(false)
    }
  }

  useEffect(() => {
    if (!expandedId) return
    if (closeByMap[expandedId] !== undefined) return
    if (closeByLoadingId) return
    const row = rows.find((r) => r.id === expandedId)
    if (!row) return
    const isClosed = (row.status || '').toUpperCase() === 'CLOSE' || !!row.closedAt
    if (!isClosed) return
    if (typeof row.closeBy !== 'undefined') {
      setCloseByMap((prev) => ({ ...prev, [expandedId]: (row.closeBy || '').trim() || null }))
      return
    }

    const controller = new AbortController()
    ;(async () => {
      setCloseByLoadingId(expandedId)
      try {
        const res = await fetch(`/api/trouble-tickets/${expandedId}`, { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as { closeBy?: unknown }
        if (!res.ok) return
        const closeBy = typeof data.closeBy === 'string' ? data.closeBy.trim() : ''
        setCloseByMap((prev) => ({ ...prev, [expandedId]: closeBy || null }))
      } catch {}
      finally {
        setCloseByLoadingId(null)
      }
    })()

    return () => controller.abort()
  }, [closeByLoadingId, closeByMap, expandedId, rows])

  const handleDeleteTicket = async (id: number) => {
    if (!canDelete) return
    if (!confirm('Hapus ticket ini?')) return
    setDeletingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/trouble-tickets/${id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus ticket')
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      if (expandedId === id) setExpandedId(null)
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeletingId(null)
    }
  }

  const copyRowDetail = async (row: TroubleTicketRow) => {
    try {
      await navigator.clipboard.writeText(buildTicketDetailText(row))
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setError('Gagal copy ke clipboard')
    }
  }

  const toggleRowSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAllCurrent = () => {
    const pageIds = rows.map((r) => r.id)
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedIds((prev) => {
        const s = new Set(prev)
        pageIds.forEach((id) => s.add(id))
        return Array.from(s)
      })
    }
  }

  const deleteSelected = async () => {
    if (!canDelete) return
    if (selectedIds.length === 0) return
    if (!confirm(`Hapus ${selectedIds.length} ticket yang dipilih?`)) return
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/trouble-tickets/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus')
      setSelectedIds([])
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)
    try {
      const XLSX = await import('xlsx')
      const dataToExport = rows.map((r) => ({
        'ID TICKET': r.ticketCode || String(r.id),
        'NAMA PELANGGAN': r.customerName,
        'USER': r.user || '',
        'NO WA': r.waNumber,
        'IN MAPS': r.mapsUrl || '',
        'TYPE': formatTypeLabel(r.type),
        'GANGGUAN': (r.problemCategory || '').trim(),
        'TINDAKAN': (r.resolutionAction || '').trim(),
        'OPEN': formatExcelDate(r.openedAt),
        'CLOSE': formatExcelDate(r.closedAt),
        'DURASI': (() => {
          const openedAtMs = new Date(r.openedAt).getTime()
          const closedAtMs = r.closedAt ? new Date(r.closedAt).getTime() : null
          const durationMs = Number.isFinite(openedAtMs) ? (closedAtMs ?? now) - openedAtMs : NaN
          return formatDurationMs(durationMs)
        })(),
        'KETERANGAN': r.notes || '',
      }))

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'TroubleTickets')
      XLSX.writeFile(workbook, `Trouble_Ticket_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFileChange = async (file: File | null) => {
    if (!file) return
    setIsImporting(true)
    setError(null)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

      const mapped = jsonData
        .map((row) => {
          const entries = Object.entries(row || {})
          const get = (...candidates: string[]) => {
            for (const [k, v] of entries) {
              const nk = normalizeHeader(k)
              if (candidates.includes(nk)) return v
            }
            return null
          }

          const ticketCode = String(get('ID TICKET', 'ID', 'TICKET', 'TICKET ID') ?? '').trim()
          const customerName = String(get('NAMA PELANGGAN', 'NAMA', 'CUSTOMER', 'CUSTOMER NAME') ?? '').trim()
          const user = String(get('USER', 'EMAIL', 'USER EMAIL', 'USERID') ?? '').trim()
          const waNumberRaw = String(get('NO WA', 'NOHP', 'NO HP', 'WA', 'WHATSAPP') ?? '').trim()
          const waNumber = waNumberRaw || '-'
          const mapsUrl = String(get('IN MAPS', 'MAPS', 'GOOGLE MAPS', 'LINK MAPS') ?? '').trim()
          const typeRaw = String(get('TYPE', 'TIPE', 'JENIS') ?? '').trim()
          const problemCategory = String(get('GANGGUAN', 'JENIS GANGGUAN', 'KATEGORI', 'PROBLEM') ?? '').trim()
          const resolutionAction = String(get('TINDAKAN', 'PENANGANAN', 'ACTION', 'RESOLUTION') ?? '').trim()
          const notes = String(get('KETERANGAN', 'NOTES', 'NOTE', 'KET') ?? '').trim()
          const openedAtRaw = get('OPEN', 'OPENED', 'OPEN DATE', 'TGL OPEN')
          const closedAtRaw = get('CLOSE', 'CLOSED', 'CLOSE DATE', 'TGL CLOSE')
          const openedAt = parseExcelDate(openedAtRaw)
          const closedAt = parseExcelDate(closedAtRaw)
          const typeKey = normalizeTypeKey(typeRaw)
          const type = slaDays[typeKey] ? typeKey : typeRaw

          if (!customerName || !type) return null

          return {
            ticketCode,
            customerName,
            user,
            waNumber,
            mapsUrl,
            type,
            problemCategory,
            resolutionAction,
            notes,
            openedAt: openedAt ? openedAt.toISOString() : null,
            closedAt: closedAt ? closedAt.toISOString() : null,
            status: closedAt ? 'CLOSE' : 'OPEN',
            month,
            year,
          }
        })
        .filter(Boolean) as Array<Record<string, unknown>>

      if (mapped.length === 0) {
        throw new Error('No rows (pastikan kolom minimal: NAMA PELANGGAN dan TYPE).')
      }

      const res = await fetch('/api/trouble-tickets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mapped }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; success?: number; failed?: number }
      if (!res.ok) {
        throw new Error(data.error || 'Gagal import')
      }
      alert(`Import selesai. Berhasil: ${Number(data.success ?? 0)} | Gagal: ${Number(data.failed ?? 0)}`)
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsImporting(false)
      const el = document.getElementById(fileInputId) as HTMLInputElement | null
      if (el) el.value = ''
    }
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {!isTroubleshoots && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-md bg-blue-600 dark:bg-blue-700 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">Ticket Open : {summary.open}</span>
          </div>
          <div className="rounded-md bg-green-600 dark:bg-green-700 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">Ticket Close : {summary.close}</span>
          </div>
          <div className="rounded-md bg-red-600 dark:bg-red-700 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">Ticket Overdue : {summary.overdue}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          {!isTroubleshoots && (
            <>
              <div className="flex flex-col">
                <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Bulan</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white md:w-44"
                >
                  {months.map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Tahun</span>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white md:w-32"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="flex flex-col">
            <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Cari</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white md:w-72"
              placeholder="Nama / WA / Tipe / Keterangan"
            />
          </div>
          {!isTroubleshoots ? (
            <div className="flex flex-col">
              <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ALL' | 'OPEN' | 'CLOSE' | 'OVERDUE')}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white md:w-40"
              >
                <option value="ALL">Semua</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSE">CLOSE</option>
                <option value="OVERDUE">OVERDUE</option>
              </select>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'OPEN' | 'CLOSE')}
                className="w-full rounded-md border border-gray-600 bg-black px-3 py-2 text-sm text-white md:w-40"
              >
                <option value="OPEN">OPEN</option>
                <option value="CLOSE">CLOSE</option>
              </select>
            </div>
          )}
        </div>

        {!isTroubleshoots && (
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              id={fileInputId}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleImportFileChange(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={handleExport}
              disabled={isExporting || rows.length === 0}
              className="rounded-md bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Export Excel
            </button>
            {isPrivileged && (
              <label
                htmlFor={fileInputId}
                className={clsx(
                  'rounded-md px-3 py-2 text-sm font-medium text-white cursor-pointer text-center',
                  isImporting ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                )}
              >
                {isImporting ? 'Importing...' : 'Import Excel'}
              </label>
            )}
            {canCreate && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm font-medium"
              >
                Create Ticket
              </button>
            )}
            {canDelete && (
              <button
                onClick={deleteSelected}
                disabled={isDeleting || selectedIds.length === 0}
                className="rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Hapus Terpilih
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {isTroubleshoots && (
        <div className="space-y-2">
          {loading ? (
            <div className="rounded-lg bg-black text-white px-4 py-6 text-center text-sm">Memuat...</div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg bg-black text-white px-4 py-6 text-center text-sm">Tidak ada data</div>
          ) : (
            rows.map((r) => {
              const { label, Icon, iconClass } = getTroubleshootsTypeMeta(r.type)
              const d = new Date(r.openedAt)
              const dt = Number.isNaN(d.getTime())
                ? '-'
                : `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
              const code = r.ticketCode || String(r.id)
              const statusLabel = ((r.status || '').toUpperCase() === 'CLOSE' || r.closedAt) ? 'Close' : 'New'
              const mapsLink = (r.mapsUrl || '').trim()
              const wa = normalizeWaNumber(r.waNumber)
              const mapsHref = normalizeMapsLink(mapsLink)
              const isClosed = (r.status || '').toUpperCase() === 'CLOSE' || !!r.closedAt
              const typeKey = normalizeTypeKey(r.type)
              const sla = slaDays[typeKey] ?? 1
              const openedAtMs = new Date(r.openedAt).getTime()
              const dueAtMs = openedAtMs + sla * 24 * 60 * 60 * 1000
              const overdueMs = now - dueAtMs
              const isOverdue = !isClosed && Number.isFinite(openedAtMs) && overdueMs > 0

              return (
                <div key={r.id} className="rounded-lg bg-black text-white border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === r.id ? null : r.id))}
                    className="w-full px-4 py-3 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={clsx('h-6 w-6 mt-0.5', iconClass)} />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-bold tracking-wide">
                          <span>{label} - {dt} - {code} - {statusLabel}</span>
                          {isOverdue && (
                            <span className="inline-flex items-center rounded-full bg-red-600/25 text-red-200 border border-red-600/40 px-2 py-0.5 text-[11px] font-extrabold tracking-wider">
                              OVERDUE {formatOverdueShort(overdueMs)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-200">{r.customerName}</div>
                        {(String(r.problemCategory ?? '').trim() || String(r.resolutionAction ?? '').trim()) && (
                          <div className="mt-1 text-xs text-gray-400">
                            {(String(r.problemCategory ?? '').trim() || '-')}
                            {' • '}
                            {(String(r.resolutionAction ?? '').trim() || '-')}
                          </div>
                        )}
                      </div>
                      <div className="pt-0.5 text-gray-300">
                        {expandedId === r.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </button>

                  {expandedId === r.id && (
                    <div className="px-4 pb-4">
                      <div className="mt-2 space-y-2 text-sm">
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">Nama Pelanggan</div>
                          <div className="font-semibold">{r.customerName}</div>
                        </div>
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">No Ticket</div>
                          <div className="font-semibold">{code}</div>
                        </div>
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">No WA</div>
                          {wa ? (
                            <a
                              href={`https://wa.me/${wa}`}
                              target="_blank"
                              rel="noreferrer"
                              className="break-words font-semibold text-blue-300 hover:underline"
                            >
                              {r.waNumber}
                            </a>
                          ) : (
                            <div className="break-words">{r.waNumber || '-'}</div>
                          )}
                        </div>
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">Jenis Gangguan</div>
                          <div className="whitespace-pre-wrap break-words">{(String(r.problemCategory ?? '').trim() || '-')}</div>
                        </div>
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">Tindakan</div>
                          <div className="whitespace-pre-wrap break-words">{(String(r.resolutionAction ?? '').trim() || '-')}</div>
                        </div>
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">Keterangan</div>
                          <div className="whitespace-pre-wrap break-words">{(r.notes || '').trim() || '-'}</div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <a
                          href={mapsHref || '#'}
                          target={mapsHref ? '_blank' : undefined}
                          rel={mapsHref ? 'noreferrer' : undefined}
                          className={clsx(
                            'rounded-md border border-gray-600 bg-gray-200 text-gray-900 px-3 py-3 text-center text-sm font-medium',
                            !mapsHref && 'opacity-50 pointer-events-none'
                          )}
                        >
                          View Location
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = `/trouble-ticket/close/${r.id}`
                          }}
                          disabled={isClosed}
                          className="rounded-md border border-gray-600 bg-gray-200 text-gray-900 px-3 py-3 text-center text-sm font-medium"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => { void openDetail(r) }}
                          className="inline-flex items-center gap-2 rounded-md bg-gray-800 text-gray-100 px-3 py-2 text-xs font-semibold hover:bg-gray-700 border border-gray-700"
                        >
                          <Info className="h-4 w-4" />
                          Rincian
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {!isTroubleshoots && (
      <div className="space-y-2">
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="rounded-lg bg-white dark:bg-gray-800 px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-300 shadow">
              Memuat...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg bg-white dark:bg-gray-800 px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-300 shadow">
              Tidak ada data
            </div>
          ) : (
            rows.map((r) => {
              const wa = normalizeWaNumber(r.waNumber)
              const mapsLink = (r.mapsUrl || '').trim()
              const isClosed = (r.status || '').toUpperCase() === 'CLOSE' || !!r.closedAt
              const code = (() => {
                const c = r.ticketCode || String(r.id)
                const datePart = formatDateForTicketId(r.openedAt)
                return datePart ? `${c}/${datePart}` : c
              })()

              return (
                <div key={r.id} className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => void openDetail(r)}
                        className="block text-left text-sm font-bold text-gray-900 dark:text-white hover:underline break-words"
                      >
                        {code}
                      </button>
                      <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white break-words">
                        {r.customerName}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-300 break-words">
                        {(r.user || '').trim() || '-'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(r.id)}
                        onChange={() => toggleRowSelected(r.id)}
                        aria-label="Pilih"
                      />
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
                          isClosed
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        )}
                      >
                        {isClosed ? 'CLOSE' : 'OPEN'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-200">
                    <div className="min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">Type</div>
                      <div className="font-semibold break-words">{formatTypeLabel(r.type)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">No WA</div>
                      {wa ? (
                        <a
                          href={`https://wa.me/${wa}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline break-words"
                        >
                          {r.waNumber}
                        </a>
                      ) : (
                        <div className="font-semibold break-words">{r.waNumber || '-'}</div>
                      )}
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">Gangguan</div>
                      <div className="font-semibold break-words">{(r.problemCategory || '').trim() || '-'}</div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">Tindakan</div>
                      <div className="font-semibold break-words">{(r.resolutionAction || '').trim() || '-'}</div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">Keterangan</div>
                      <div className="font-semibold break-words">{(r.notes || '').trim() || '-'}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openDetail(r)}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-100 text-gray-800 px-3 py-2 text-xs font-semibold hover:bg-gray-200 border border-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:border-gray-600"
                    >
                      <Info className="h-4 w-4" />
                      Rincian
                    </button>
                    {mapsLink && (
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-md bg-blue-50 text-blue-700 px-3 py-2 text-xs font-semibold hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/30 dark:border-blue-800"
                      >
                        View Maps
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-100 text-gray-800 px-3 py-2 text-xs font-semibold hover:bg-gray-200 border border-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:border-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    {!isClosed && (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `/trouble-ticket/close/${r.id}`
                        }}
                        className="inline-flex items-center gap-2 rounded-md bg-green-600 text-white px-3 py-2 text-xs font-semibold hover:bg-green-700"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="hidden md:block rounded-lg bg-white dark:bg-gray-800 shadow">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-auto">
          <thead className="bg-gray-50 dark:bg-gray-900/20">
            <tr>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selectedSet.has(r.id))}
                  onChange={toggleSelectAllCurrent}
                />
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">ID Ticket</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Nama Pelanggan</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">User</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">No WA</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">In Maps</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Type</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Gangguan</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Tindakan</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Open</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Close</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Durasi</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  Memuat...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const openedAtMs = new Date(r.openedAt).getTime()
                const closedAtMs = r.closedAt ? new Date(r.closedAt).getTime() : null
                const durationMs = Number.isFinite(openedAtMs) ? (closedAtMs ?? now) - openedAtMs : NaN
                const wa = normalizeWaNumber(r.waNumber)
                const mapsLink = (r.mapsUrl || '').trim()
                const isClosed = (r.status || '').toUpperCase() === 'CLOSE' || !!r.closedAt

                return (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(r.id)}
                          onChange={() => toggleRowSelected(r.id)}
                        />
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedId((prev) => (prev === r.id ? null : r.id))}
                            className="text-gray-500 hover:text-blue-600 dark:text-white dark:hover:text-blue-300 focus:outline-none"
                            aria-label="Toggle"
                          >
                            {expandedId === r.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void openDetail(r)
                            }}
                            className="text-left hover:underline"
                          >
                            {(() => {
                              const code = r.ticketCode || String(r.id)
                              const datePart = formatDateForTicketId(r.openedAt)
                              return datePart ? `${code}/${datePart}` : code
                            })()}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200">{r.customerName}</td>
                      <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200">{(r.user || '').trim() || '-'}</td>
                      <td className="px-3 py-3 text-sm">
                        {wa ? (
                          <a
                            href={`https://wa.me/${wa}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {r.waNumber}
                          </a>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">{r.waNumber || '-'}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {mapsLink ? (
                          <a
                            href={mapsLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200">{formatTypeLabel(r.type)}</td>
                      <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200">{(r.problemCategory || '').trim() || '-'}</td>
                      <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200">{(r.resolutionAction || '').trim() || '-'}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDateTime(r.openedAt)}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDateTime(r.closedAt)}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDurationMs(durationMs)}</td>
                      <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            (r.status || '').toUpperCase() === 'CLOSE'
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          )}
                        >
                          {(r.notes || '').trim() || '-'}
                        </span>
                      </td>
                    </tr>
                    {expandedId === r.id && (
                      <tr>
                        <td colSpan={13} className="px-3 pb-4">
                          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="text-sm text-gray-700 dark:text-gray-200">
                                <div className="font-semibold">Action</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {isClosed
                                    ? `Ticket CLOSE by ${(closeByMap[r.id] ?? '').trim() || '-'}`
                                    : 'Ticket masih OPEN'}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void openDetail(r)
                                  }}
                                  className="inline-flex items-center gap-2 rounded-md bg-gray-50 text-gray-700 px-3 py-2 text-xs font-semibold hover:bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
                                >
                                  <Info className="h-4 w-4" />
                                  Rincian
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyRowDetail(r)}
                                  className="inline-flex items-center gap-2 rounded-md bg-blue-50 text-blue-700 px-3 py-2 text-xs font-semibold hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/30 dark:border-blue-800"
                                >
                                  <Clipboard className="h-4 w-4" />
                                  {copied ? 'Tercopy' : 'Copy'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedId(null)
                                    openEdit(r)
                                  }}
                                  className="inline-flex items-center gap-2 rounded-md bg-gray-50 text-gray-700 px-3 py-2 text-xs font-semibold hover:bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.location.href = `/trouble-ticket/close/${r.id}`
                                  }}
                                  disabled={isClosed}
                                  className="inline-flex items-center gap-2 rounded-md bg-green-50 text-green-700 px-3 py-2 text-xs font-semibold hover:bg-green-100 border border-green-200 disabled:opacity-50 dark:bg-green-900/20 dark:text-green-200 dark:hover:bg-green-900/30 dark:border-green-800"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Close
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTicket(r.id)}
                                  disabled={deletingId === r.id}
                                  className="inline-flex items-center gap-2 rounded-md bg-red-50 text-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-100 border border-red-200 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-200 dark:hover:bg-red-900/30 dark:border-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {deletingId === r.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
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

        <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              {total > 0 ? `Menampilkan ${pageStart}–${pageEnd} dari ${total} data` : 'Tidak ada data'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Tampil</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
                >
                  {[25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!canPrevPage}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <div className="text-sm text-gray-700 dark:text-gray-200">Halaman {page}</div>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!canNextPage}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-lg bg-white dark:bg-gray-800 shadow-lg">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="text-lg font-bold text-gray-900 dark:text-white">Create Trouble Ticket</div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ID Ticket otomatis: {idPrefix}{formatTicketNumber(nextNumber)}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Kategori</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as 'TT' | 'PV' })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  >
                    <option value="TT">Trouble Ticket (TT)</option>
                    <option value="PV">Preventive (PV)</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Nama Pelanggan</span>
                  <input
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">User</span>
                  <input
                    value={form.user}
                    onChange={(e) => setForm({ ...form, user: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">No WA</span>
                  <input
                    value={form.waNumber}
                    onChange={(e) => setForm({ ...form, waNumber: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">In Maps</span>
                  <input
                    value={form.mapsUrl}
                    onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                    placeholder="https://maps.google.com/..."
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Type</span>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    disabled={form.category === 'PV'}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  >
                    <option value="">Pilih type...</option>
                    {(form.category === 'PV'
                      ? ['PREVENTIVE']
                      : slaTypes.filter((t) => normalizeTypeKey(t) !== 'PREVENTIVE')
                    ).map((t) => (
                      <option key={t} value={t}>
                        {formatTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Jenis Gangguan</span>
                  <select
                    value={form.problemCategory}
                    onChange={(e) => setForm({ ...form, problemCategory: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  >
                    <option value="">Pilih...</option>
                    {problemOptions.map((x) => (
                      <option key={x} value={x}>
                        {formatTypeLabel(x)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Keterangan</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="min-h-[90px] w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="rounded-md bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-lg bg-white dark:bg-gray-800 shadow-lg">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="text-lg font-bold text-gray-900 dark:text-white">Edit Trouble Ticket</div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Nama Pelanggan</span>
                  <input
                    value={editForm.customerName}
                    onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">User</span>
                  <input
                    value={editForm.user}
                    onChange={(e) => setEditForm({ ...editForm, user: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">No WA</span>
                  <input
                    value={editForm.waNumber}
                    onChange={(e) => setEditForm({ ...editForm, waNumber: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">In Maps</span>
                  <input
                    value={editForm.mapsUrl}
                    onChange={(e) => setEditForm({ ...editForm, mapsUrl: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                    placeholder="https://maps.google.com/..."
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Type</span>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  >
                    <option value="">Pilih type...</option>
                    {(editingCategory === 'PV'
                      ? ['PREVENTIVE']
                      : slaTypes.filter((t) => normalizeTypeKey(t) !== 'PREVENTIVE')
                    ).map((t) => (
                      <option key={t} value={t}>
                        {formatTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Jenis Gangguan</span>
                  <select
                    value={editForm.problemCategory}
                    onChange={(e) => setEditForm({ ...editForm, problemCategory: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  >
                    <option value="">Pilih...</option>
                    {problemOptions.map((x) => (
                      <option key={x} value={x}>
                        {formatTypeLabel(x)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Status</span>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'OPEN' | 'CLOSE' })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSE">CLOSE</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Keterangan</span>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="min-h-[90px] w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => { setIsEditOpen(false); setEditingId(null) }}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="rounded-md bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-800 shadow-lg">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="text-lg font-bold text-gray-900 dark:text-white">Rincian Trouble Ticket</div>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <textarea
                readOnly
                value={detailText}
                className="w-full min-h-[220px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
              />
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                {(((detailRow.status || '').toUpperCase() === 'CLOSE' || !!detailRow.closedAt) &&
                  (Number(detailRow.closePhotosCount || 0) > 0 ||
                    (Array.isArray(detailRow.closePhotoUrls) && detailRow.closePhotoUrls.length > 0) ||
                    (Array.isArray(detailRow.closePhotos) && detailRow.closePhotos.length > 0))) && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!detailRow) return
                      const hasUrls = Array.isArray(detailRow.closePhotoUrls)
                      const hasLegacy = Array.isArray(detailRow.closePhotos)
                      if (!hasUrls && !hasLegacy) {
                        await ensureDetailPhotos(detailRow.id)
                      }
                      setIsPhotoViewerOpen(true)
                    }}
                    className="rounded-md bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 text-sm font-medium"
                    disabled={detailFetching}
                  >
                    View
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShareWa}
                  className="rounded-md bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium"
                  disabled={detailFetching}
                >
                  Kirim ke WA
                </button>
                <button
                  type="button"
                  onClick={handleCopyDetail}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium"
                  disabled={detailFetching}
                >
                  <Clipboard className="h-4 w-4" />
                  {copied ? 'Tercopy' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailRow && isPhotoViewerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-4xl rounded-lg bg-white dark:bg-gray-800 shadow-lg">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="text-lg font-bold text-gray-900 dark:text-white">Foto Lokasi</div>
              <button
                type="button"
                onClick={() => setIsPhotoViewerOpen(false)}
                className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              {(() => {
                const sources = (Array.isArray(detailRow.closePhotoUrls) ? detailRow.closePhotoUrls : null) ??
                  (Array.isArray(detailRow.closePhotos) ? detailRow.closePhotos : null) ??
                  []
                if (sources.length === 0) {
                  return <div className="text-sm text-gray-600 dark:text-gray-300">Tidak ada foto</div>
                }
                return (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-md border border-gray-200 dark:border-gray-700"
                      >
                        <NextImage
                          src={src}
                          alt={`foto-${idx + 1}`}
                          width={800}
                          height={600}
                          unoptimized
                          className="h-32 w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
