'use client'

import { Fragment, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Pencil, CheckCircle2, Clipboard, X, Trash2, Info, ArrowUp, AlertTriangle, ArrowRight } from 'lucide-react'
import NextImage from 'next/image'
import { useRouter } from 'next/navigation'
import { canMutateTroubleTicketRecords, isAdminRole, isTechnicianRole } from '@/lib/access'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeading } from '@/components/ui/SectionHeading'

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
  ont?: string | null
  paket?: string | null
  openedAt: string
  closedAt: string | null
  temporaryAt: string | null
  notes: string | null
  problemCategory?: string | null
  resolutionAction?: string | null
  closeNotes?: string | null
  closePhotos?: string[] | null
  closePhotoUrls?: string[] | null
  closePhotosCount?: number | null
  closeBy?: string | null
  status: string
  odpId?: number | null
  portNumber?: number | null
  sn?: string | null
}

type OdpOption = {
  id: number
  nama_odp: string
  wilayah: string
  lokasi?: string | null
  latitude?: number | null
  longitude?: number | null
}

type TroubleTicketCreatePayload = {
  category: 'TT' | 'PV'
  ticketCode: string
  customerName: string
  user: string
  waNumber: string
  mapsUrl: string
  type: string
  ont: string
  paket: string
  notes: string
  problemCategory: string
  odpId?: number | null
  portNumber?: number | null
  sn?: string | null
}

type TroubleTicketEditPayload = {
  customerName: string
  user: string
  waNumber: string
  mapsUrl: string
  type: string
  ont: string
  paket: string
  problemCategory: string
  status: 'OPEN' | 'CLOSE'
  notes: string
  odpId?: number | null
  portNumber?: number | null
  sn?: string | null
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

function TroubleTicketDetailSection({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value: ReactNode }>
}) {
  return (
    <section className="min-w-0">
      <h3 className="border-b border-gray-200 px-3 py-3 text-sm font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-100">
        {title}
      </h3>
      <dl className="divide-y divide-gray-200 dark:divide-gray-600">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="grid grid-cols-[minmax(6.5rem,0.8fr)_auto_minmax(0,1.4fr)] items-start gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200"
          >
            <dt className="text-gray-600 dark:text-gray-300">{label}</dt>
            <span aria-hidden="true" className="text-gray-400 dark:text-gray-500">:</span>
            <dd className="min-w-0 whitespace-pre-wrap break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
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

// Aturan tunggal: jam berhenti saat Close, atau saat Temporary (dipakai durasi & overdue).
function getTicketEndMs(row: { closedAt?: string | null; temporaryAt?: string | null }, nowMs: number) {
  const closedMs = row.closedAt ? new Date(row.closedAt).getTime() : Number.NaN
  if (Number.isFinite(closedMs)) return closedMs
  const temporaryMs = row.temporaryAt ? new Date(row.temporaryAt).getTime() : Number.NaN
  if (Number.isFinite(temporaryMs)) return temporaryMs
  return nowMs
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

function stripPeriodSegment(codeOrPrefix: string) {
  const raw = String(codeOrPrefix ?? '').trim()
  if (!raw) return ''
  const parts = raw.split('/').filter(Boolean).filter((p) => !/^\d{2}\.\d{4}$/.test(p))
  return parts.length ? `${parts.join('/')}/` : ''
}

function splitTicketCode(code: string) {
  const raw = String(code ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^(.*\/)(\d+)\s*$/)
  if (!m) return null
  const prefix = stripPeriodSegment(m[1])
  const number = Math.trunc(Number(m[2]))
  if (!Number.isFinite(number) || number < 1) return null
  return { prefix, number }
}

function getDisplayTicketCode(row: TroubleTicketRow) {
  const number =
    row.ticketNumber ??
    (() => {
      const parsed = row.ticketCode ? splitTicketCode(row.ticketCode) : null
      return parsed?.number ?? null
    })()

  const prefix =
    stripPeriodSegment(row.ticketPrefix || '') ||
    (() => {
      const parsed = row.ticketCode ? splitTicketCode(row.ticketCode) : null
      return parsed?.prefix || ''
    })()

  if (prefix && number) return `${prefix}${formatTicketNumber(number)}`
  if (row.ticketCode) return stripPeriodSegment(row.ticketCode).replace(/\/$/, '')
  return String(row.id)
}

function getDisplayTicketId(row: TroubleTicketRow) {
  const code = getDisplayTicketCode(row)
  const datePart = formatDateForTicketId(row.openedAt)
  return datePart ? `${code}/${datePart}` : code
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

function buildTicketDetailText(row: TroubleTicketRow, odps: Array<{ id: number; nama_odp: string }> = []) {
  const ticketId = getDisplayTicketId(row)
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
    `Paket\t: ${(row.paket || '').trim() || '-'}`,
    `ONT : ${(row.ont || '').trim() || '-'}`,
    ...(row.odpId ? [`ODP : ${odps.find((o) => o.id === row.odpId)?.nama_odp ?? row.odpId}`] : []),
    ...(row.portNumber ? [`Port : ${row.portNumber}`] : []),
    ...(row.sn ? [`SN : ${row.sn}`] : []),
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

export function TroubleTicketView({
  userRole,
  initialDivision = 'ALL',
}: {
  userRole: string
  initialDivision?: 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'
}) {
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
  const [repeatedUsers, setRepeatedUsers] = useState<string[]>([])
  const [month, setMonth] = useState(nowDate.getMonth() + 1)
  const [year, setYear] = useState(nowDate.getFullYear())
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const division = initialDivision
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'CLOSE' | 'OVERDUE'>(
    (userRole || '').toUpperCase() === 'TROUBLESHOOTS' ? 'OPEN' : 'ALL'
  )
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [summaryRemote, setSummaryRemote] = useState<{ open: number; preventiveOpen: number; close: number; overdue: number }>({
    open: 0,
    preventiveOpen: 0,
    close: 0,
    overdue: 0,
  })
  const [repeatedCountRemote, setRepeatedCountRemote] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [mobileExpandedId, setMobileExpandedId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [detailRow, setDetailRow] = useState<TroubleTicketRow | null>(null)
  const [detailFetching, setDetailFetching] = useState(false)
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false)
  const [closeByMap, setCloseByMap] = useState<Record<number, string | null>>({})
  const [closeByLoadingId, setCloseByLoadingId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const [odps, setOdps] = useState<OdpOption[]>([])

  const fetchOdps = useCallback(async () => {
    try {
      const res = await fetch('/api/odp?all=1')
      const data = await res.json()
      if (res.ok) setOdps(data)
    } catch (e) {
      console.error('Failed to fetch ODPs', e)
    }
  }, [])

  useEffect(() => {
    if (isCreateOpen || isEditOpen) {
      fetchOdps()
    }
  }, [isCreateOpen, isEditOpen, fetchOdps])

  const [form, setForm] = useState<TroubleTicketCreatePayload>({
    category: 'TT',
    ticketCode: '',
    customerName: '',
    user: '',
    waNumber: '',
    mapsUrl: '',
    type: '',
    ont: '',
    paket: '',
    notes: '',
    problemCategory: '',
    odpId: null,
    portNumber: null,
    sn: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingCategory, setEditingCategory] = useState<'TT' | 'PV'>('TT')
  const [editForm, setEditForm] = useState<TroubleTicketEditPayload>({
    customerName: '',
    user: '',
    waNumber: '',
    mapsUrl: '',
    type: '',
    ont: '',
    paket: '',
    problemCategory: '',
    status: 'OPEN',
    notes: '',
    odpId: null,
    portNumber: null,
    sn: '',
  })
  const [slaDays, setSlaDays] = useState<Record<string, number>>(DEFAULT_SLA_DAYS)
  const [slaTypes, setSlaTypes] = useState<string[]>(Object.keys(DEFAULT_SLA_DAYS))
  const [problemOptions, setProblemOptions] = useState<string[]>([...DEFAULT_PROBLEM_CATEGORIES])
  const [ontOptions, setOntOptions] = useState<string[]>([])
  const [idPrefix, setIdPrefix] = useState('TT/PKN/')
  const [nextNumber, setNextNumber] = useState(1)

  const roleUpper = (userRole || '').toUpperCase()
  const isAdmin = isAdminRole(roleUpper)
  const isTroubleshoots = isTechnicianRole(roleUpper)
  const canCreate = useMemo(() => canMutateTroubleTicketRecords(roleUpper), [roleUpper])
  const canDelete = useMemo(() => canMutateTroubleTicketRecords(roleUpper), [roleUpper])
  const isPrivileged = useMemo(() => canMutateTroubleTicketRecords(roleUpper), [roleUpper])
  const supportsTroubleTicketWorkflow = !isAdmin || division === 'ALL' || division === 'NOC_TROUBLESHOOTS'
  const fileInputId = 'trouble-ticket-import-input'
  const closeCreateModal = useCallback(() => setIsCreateOpen(false), [])
  const closeEditModal = useCallback(() => {
    setIsEditOpen(false)
    setEditingId(null)
  }, [])
  const closePhotoViewer = useCallback(() => setIsPhotoViewerOpen(false), [])
  const closeDetailModal = useCallback(() => {
    setIsPhotoViewerOpen(false)
    setDetailRow(null)
    setCopied(false)
  }, [])
  const hasAnyModalOpen = isCreateOpen || isEditOpen || !!detailRow || isPhotoViewerOpen

  useEffect(() => {
    if (!hasAnyModalOpen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isPhotoViewerOpen) {
        closePhotoViewer()
        return
      }
      if (detailRow) {
        closeDetailModal()
        return
      }
      if (isEditOpen) {
        closeEditModal()
        return
      }
      if (isCreateOpen) {
        closeCreateModal()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeCreateModal, closeDetailModal, closeEditModal, closePhotoViewer, detailRow, hasAnyModalOpen, isCreateOpen, isEditOpen, isPhotoViewerOpen])

  useEffect(() => {
    if (!isTroubleshoots) return
    if (status !== 'OPEN' && status !== 'CLOSE') setStatus('OPEN')
  }, [isTroubleshoots, status])

  useEffect(() => {
    if (isTroubleshoots) return
    setPage(1)
  }, [division, isTroubleshoots, month, year, status, debouncedSearch, pageSize])

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

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/trouble-tickets/master?kind=ONT', { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as unknown
        if (!res.ok) return
        const rows = Array.isArray(data) ? (data as Array<{ value?: unknown }>) : []
        const values = rows
          .map((r) => String(r?.value ?? '').trim())
          .filter(Boolean)
        setOntOptions(values)
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
      if (!isTroubleshoots && isAdmin && division !== 'ALL') params.set('division', division)
      if (!isTroubleshoots && status === 'OVERDUE') params.set('overdue', '1')
      if (status !== 'ALL') params.set('status', status === 'OVERDUE' ? 'OPEN' : status)
      const res = await fetch(`/api/trouble-tickets?${params.toString()}`, { signal })
      const data = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) {
        const msg = (data as { error?: string })?.error || 'Gagal memuat data'
        throw new Error(msg)
      }
      if (!isTroubleshoots) {
        const dupe = (data as { repeatedUsers?: unknown }).repeatedUsers
        setRepeatedUsers(Array.isArray(dupe) ? dupe.map((v) => String(v ?? '').trim()).filter(Boolean) : [])
        setRepeatedCountRemote(Math.trunc(Number((data as { repeatedCount?: unknown }).repeatedCount ?? 0)) || 0)
      } else {
        setRepeatedUsers([])
        setRepeatedCountRemote(0)
      }
      const nextRows = (isTroubleshoots
        ? (Array.isArray(data) ? data : [])
        : (Array.isArray((data as { items?: unknown }).items) ? (data as { items: unknown[] }).items : [])) as TroubleTicketRow[]
      if (!isTroubleshoots) {
        const t = Math.trunc(Number((data as { total?: unknown }).total))
        setTotal(Number.isFinite(t) && t >= 0 ? t : 0)
        const s = (data as { summary?: { open?: unknown; preventiveOpen?: unknown; close?: unknown; overdue?: unknown } }).summary
        setSummaryRemote({
          open: Math.trunc(Number(s?.open ?? 0)) || 0,
          preventiveOpen: Math.trunc(Number(s?.preventiveOpen ?? 0)) || 0,
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
              const endMs = getTicketEndMs(r, nowMs)
              return Number.isFinite(t) && endMs - t > limitMs
            })
          : status === 'OVERDUE'
            ? nextRows
            : nextRows
      )
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
      setRepeatedUsers([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, division, isAdmin, isTroubleshoots, month, page, pageSize, slaDays, status, year])

  const repeatedUserSet = useMemo(() => {
    const normalizeUserKey = (value: unknown) => String(value ?? '').trim().toLowerCase()
    if (!isTroubleshoots) {
      return new Set(repeatedUsers.map((u) => normalizeUserKey(u)).filter(Boolean))
    }
    const counts = new Map<string, number>()
    for (const r of rows) {
      const key = normalizeUserKey(r.user)
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const set = new Set<string>()
    for (const [k, n] of counts) {
      if (n > 1) set.add(k)
    }
    return set
  }, [isTroubleshoots, repeatedUsers, rows])

  useEffect(() => {
    const controller = new AbortController()
    fetchRows(controller.signal)
    return () => controller.abort()
  }, [fetchRows])

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
        if (prefix) setIdPrefix(stripPeriodSegment(prefix))
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
    let preventiveOpen = 0
    let close = 0
    let overdue = 0
    for (const r of rows) {
      const st = (r.status || '').toUpperCase()
      const isClose = st === 'CLOSE' || !!r.closedAt
      const isPreventive = normalizeCategory(r.category) === 'PV' || normalizeTypeKey(r.type) === 'PREVENTIVE'
      if (isClose) close += 1
      else {
        open += 1
        if (isPreventive) preventiveOpen += 1
      }

      if (!isClose) {
        const t = new Date(r.openedAt).getTime()
        const typeKey = String(r.type ?? '').trim().toUpperCase().replace(/\s+/g, '_')
        const days = slaDays[typeKey] ?? 1
        const limitMs = days * 24 * 60 * 60 * 1000
        if (Number.isFinite(t) && getTicketEndMs(r, now) - t > limitMs) overdue += 1
      }
    }
    return { open, preventiveOpen, close, overdue }
  }, [isTroubleshoots, rows, now, slaDays, summaryRemote])

  const repeatedTicketCount = useMemo(() => {
    if (!isTroubleshoots) return repeatedCountRemote

    const repeatedKeys = new Set(
      Array.from(repeatedUserSet).filter(Boolean)
    )

    let totalRepeatedTickets = 0
    for (const row of rows) {
      const userKey = String(row.user ?? '').trim().toLowerCase()
      if (!userKey || !repeatedKeys.has(userKey)) continue

      const categoryKey = normalizeCategory(row.category)
      const typeKey = normalizeTypeKey(row.type)
      if (categoryKey === 'PV' || typeKey === 'PREVENTIVE') continue

      totalRepeatedTickets += 1
    }

    return totalRepeatedTickets
  }, [isTroubleshoots, repeatedCountRemote, repeatedUserSet, rows])

  const pageStart = !isTroubleshoots && total > 0 ? (page - 1) * pageSize + 1 : 0
  const pageEnd = !isTroubleshoots && total > 0 ? Math.min((page - 1) * pageSize + rows.length, total) : 0
  const canPrevPage = !isTroubleshoots && page > 1
  const canNextPage = !isTroubleshoots && pageEnd < total

  const handleCreate = async () => {
    if (!canCreate || !supportsTroubleTicketWorkflow) return
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
        ont: form.ont.trim(),
        paket: form.paket.trim(),
        notes: form.notes.trim(),
        problemCategory: form.problemCategory.trim(),
        odpId: form.odpId,
        portNumber: form.portNumber,
        sn: form.sn?.trim() || null,
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
        ont: '',
        paket: '',
        notes: '',
        problemCategory: '',
        odpId: null,
        portNumber: null,
        sn: '',
      })
      try {
        const res2 = await fetch(`/api/trouble-ticket-id?month=${month}&year=${year}&category=${category}`)
        const cfg = (await res2.json().catch(() => ({}))) as { prefix?: unknown; nextNumber?: unknown }
        if (res2.ok) {
          const prefix = String(cfg.prefix ?? '').trim()
          const n = Math.trunc(Number(cfg.nextNumber))
          if (prefix) setIdPrefix(stripPeriodSegment(prefix))
          if (Number.isFinite(n) && n > 0) setNextNumber(n)
        }
      } catch {}
      await fetchRows()
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
      ont: String(row.ont ?? '').trim(),
      paket: String(row.paket ?? '').trim(),
      problemCategory: String(row.problemCategory ?? '').trim(),
      status: ((row.status || '').toUpperCase() === 'CLOSE' || row.closedAt) ? 'CLOSE' : 'OPEN',
      notes: row.notes || '',
      odpId: row.odpId ?? null,
      portNumber: row.portNumber ?? null,
      sn: row.sn || '',
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
        ont: editForm.ont.trim(),
        paket: editForm.paket.trim(),
        notes: editForm.notes.trim(),
        problemCategory: editForm.problemCategory.trim(),
        status: editForm.status,
        odpId: editForm.odpId,
        portNumber: editForm.portNumber,
        sn: editForm.sn?.trim() || null,
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
      await fetchRows()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const detailText = useMemo(() => (detailRow ? buildTicketDetailText(detailRow, odps) : ''), [detailRow, odps])

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

  const downloadAllPhotos = async () => {
    if (!detailRow) return
    try {
      const sources = (Array.isArray(detailRow.closePhotoUrls) ? detailRow.closePhotoUrls : null) ??
        (Array.isArray(detailRow.closePhotos) ? detailRow.closePhotos : null) ??
        []
      if (sources.length === 0) return
      
      for (let i = 0; i < sources.length; i++) {
        const src = sources[i]
        try {
          const response = await fetch(src)
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          const ticketId = detailRow.ticketCode || `ticket-${detailRow.id}`
          const ext = src.split('.').pop()?.split('?')[0] || 'jpg'
          a.download = `${ticketId}-foto-${i + 1}.${ext}`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
          await new Promise(resolve => setTimeout(resolve, 300))
        } catch {
          const a = document.createElement('a')
          a.href = src
          a.target = '_blank'
          a.rel = 'noreferrer'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
      }
    } catch {
    }
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
      await fetchRows()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeletingId(null)
    }
  }

  const handleTemporaryTicket = async (row: TroubleTicketRow) => {
    const isClosed = (row.status || '').toUpperCase() === 'CLOSE' || !!row.closedAt
    if (isClosed) {
      alert('Ticket sudah di-close')
      return
    }
    if (row.temporaryAt) {
      alert('Ticket sudah di-temporary')
      return
    }

    const confirmed = confirm('Yakin ingin menandai ticket sebagai Temporary? Durasi akan berhenti sampai ticket di-close.')
    if (!confirmed) return

    try {
      const res = await fetch(`/api/trouble-tickets/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEMPORARY' }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Gagal menandai ticket sebagai Temporary')
      }
      await fetchRows()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(msg || 'Gagal menandai ticket sebagai Temporary')
    }
  }

  const copyRowDetail = async (row: TroubleTicketRow) => {
    try {
      await navigator.clipboard.writeText(buildTicketDetailText(row, odps))
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
    if (!canDelete || !supportsTroubleTicketWorkflow) return
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
      await fetchRows()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExport = async () => {
    if (!supportsTroubleTicketWorkflow) return
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
        'PAKET': (r.paket || '').trim(),
        'ONT': (r.ont || '').trim(),
        'GANGGUAN': (r.problemCategory || '').trim(),
        'TINDAKAN': (r.resolutionAction || '').trim(),
        'OPEN': formatExcelDate(r.openedAt),
        'CLOSE': formatExcelDate(r.closedAt),
        'DURASI': (() => {
          const openedAtMs = new Date(r.openedAt).getTime()
          const endAtMs = getTicketEndMs(r, now)
          const durationMs = Number.isFinite(openedAtMs) ? endAtMs - openedAtMs : NaN
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
    if (!file || !supportsTroubleTicketWorkflow) return
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
          const ont = String(get('ONT', 'ONT ID') ?? '').trim()

          if (!customerName || !type) return null

          return {
            ticketCode,
            customerName,
            user,
            waNumber,
            mapsUrl,
            type,
            ont,
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
      await fetchRows()
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
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center dark:border-red-800 dark:bg-red-950">
            <div className="flex flex-col items-center justify-center leading-tight">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300 md:hidden">Trouble Open</span>
              <span className="text-base font-semibold text-red-800 dark:text-red-200 md:hidden">{summary.open}</span>
              <span className="hidden text-xs font-medium text-red-700 dark:text-red-300 md:inline">Trouble Open</span>
              <span className="hidden text-lg font-semibold text-red-800 dark:text-red-200 md:inline">{summary.open}</span>
            </div>
          </div>
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-center dark:border-sky-800 dark:bg-sky-950">
            <div className="flex flex-col items-center justify-center leading-tight">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300 md:hidden">Preventive Open</span>
              <span className="text-base font-semibold text-sky-800 dark:text-sky-200 md:hidden">{summary.preventiveOpen}</span>
              <span className="hidden text-xs font-medium text-sky-700 dark:text-sky-300 md:inline">Preventive Open</span>
              <span className="hidden text-lg font-semibold text-sky-800 dark:text-sky-200 md:inline">{summary.preventiveOpen}</span>
            </div>
          </div>
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-center dark:border-green-800 dark:bg-green-950">
            <div className="flex flex-col items-center justify-center leading-tight">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-300 md:hidden">Close</span>
              <span className="text-base font-semibold text-green-800 dark:text-green-200 md:hidden">{summary.close}</span>
              <span className="hidden text-xs font-medium text-green-700 dark:text-green-300 md:inline">Close</span>
              <span className="hidden text-lg font-semibold text-green-800 dark:text-green-200 md:inline">{summary.close}</span>
            </div>
          </div>
          <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-center dark:border-orange-800 dark:bg-orange-950">
            <div className="flex flex-col items-center justify-center leading-tight">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300 md:hidden">Overdue</span>
              <span className="text-base font-semibold text-orange-800 dark:text-orange-200 md:hidden">{summary.overdue}</span>
              <span className="hidden text-xs font-medium text-orange-700 dark:text-orange-300 md:inline">Overdue</span>
              <span className="hidden text-lg font-semibold text-orange-800 dark:text-orange-200 md:inline">{summary.overdue}</span>
            </div>
          </div>
          <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-center dark:border-violet-800 dark:bg-violet-950">
            <div className="flex flex-col items-center justify-center leading-tight">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300 md:hidden">Ticket Berulang</span>
              <span className="text-base font-semibold text-violet-800 dark:text-violet-200 md:hidden">{repeatedTicketCount}</span>
              <span className="hidden text-xs font-medium text-violet-700 dark:text-violet-300 md:inline">Ticket Berulang</span>
              <span className="hidden text-lg font-semibold text-violet-800 dark:text-violet-200 md:inline">{repeatedTicketCount}</span>
            </div>
          </div>
        </div>
      )}

      <Card className="p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:items-end">
          {!isTroubleshoots && (
            <>
              <div className="flex flex-col">
                <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Bulan</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white md:w-44"
                >
                  {months.map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Tahun</span>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white md:w-32"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="col-span-2 flex flex-col md:col-span-1">
            <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Cari</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white md:w-72"
              placeholder="Nama / WA / Tipe / Keterangan"
            />
          </div>
          {!isTroubleshoots ? (
            <div className="flex flex-col">
              <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ALL' | 'OPEN' | 'CLOSE' | 'OVERDUE')}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white md:w-40"
              >
                <option value="ALL">Semua</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSE">CLOSE</option>
                <option value="OVERDUE">OVERDUE</option>
              </select>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'OPEN' | 'CLOSE')}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white md:w-40"
              >
                <option value="OPEN">OPEN</option>
                <option value="CLOSE">CLOSE</option>
              </select>
            </div>
          )}
        </div>

        {!isTroubleshoots && (
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:items-center">
            <input
              id={fileInputId}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleImportFileChange(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={handleExport}
              disabled={isExporting || rows.length === 0 || !supportsTroubleTicketWorkflow}
              className="hidden w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 md:inline-block md:w-auto"
            >
              Export Excel
            </button>
            {isPrivileged && (
              <label
                htmlFor={fileInputId}
                className={clsx(
                  'hidden w-full cursor-pointer rounded-md px-3 py-2 text-center text-sm font-medium md:inline-block md:w-auto',
                  isImporting || !supportsTroubleTicketWorkflow ? 'pointer-events-none border border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                )}
              >
                {isImporting ? 'Mengimpor...' : 'Import Excel'}
              </label>
            )}
            {canCreate && (
              <button
                onClick={() => {
                  setError(null)
                  setIsCreateOpen(true)
                }}
                disabled={!supportsTroubleTicketWorkflow}
                className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white disabled:opacity-50 md:w-auto"
              >
                Create Ticket
              </button>
            )}
            {canDelete && (
              <button
                onClick={deleteSelected}
                disabled={isDeleting || selectedIds.length === 0 || !supportsTroubleTicketWorkflow}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 md:w-auto"
              >
                Hapus Terpilih
              </button>
            )}
          </div>
        )}
      </div>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {isTroubleshoots && (
        <div className="space-y-2">
          {loading ? (
            <div className="rounded-lg border border-gray-800 bg-gray-950 px-4 py-6 text-center text-sm text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              Memuat...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-950 px-4 py-6 text-center text-sm text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              Tidak ada data
            </div>
          ) : (
            rows.map((r) => {
              const { label, Icon, iconClass } = getTroubleshootsTypeMeta(r.type)
              const d = new Date(r.openedAt)
              const dt = Number.isNaN(d.getTime())
                ? '-'
                : `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
              const code = getDisplayTicketCode(r)
              const statusLabel = ((r.status || '').toUpperCase() === 'CLOSE' || r.closedAt) ? 'Close' : 'New'
              const mapsLink = (r.mapsUrl || '').trim()
              const wa = normalizeWaNumber(r.waNumber)
              const mapsHref = normalizeMapsLink(mapsLink)
              const isClosed = (r.status || '').toUpperCase() === 'CLOSE' || !!r.closedAt
              const typeKey = normalizeTypeKey(r.type)
              const sla = slaDays[typeKey] ?? 1
              const openedAtMs = new Date(r.openedAt).getTime()
              const endAtMs = getTicketEndMs(r, now)
              const dueAtMs = openedAtMs + sla * 24 * 60 * 60 * 1000
              const overdueMs = endAtMs - dueAtMs
              const isOverdue = !isClosed && Number.isFinite(openedAtMs) && overdueMs > 0
              const remainingMs = dueAtMs - endAtMs
              const isNearOverdue = !isClosed && Number.isFinite(openedAtMs) && remainingMs > 0 && remainingMs <= 6 * 60 * 60 * 1000
              const isVeryNearOverdue = !isClosed && Number.isFinite(openedAtMs) && remainingMs > 0 && remainingMs <= 60 * 60 * 1000

              return (
                <div
                  key={r.id}
                  className={clsx(
                    'rounded-lg bg-black text-white border border-gray-800',
                    (() => {
                      const k = String(r.user ?? '').trim().toLowerCase()
                      return k && repeatedUserSet.has(k) ? 'border-orange-500/60 bg-orange-950/35' : undefined
                    })(),
                    isOverdue
                      ? 'tt-near-overdue tt-near-overdue-blink'
                      : isVeryNearOverdue
                        ? 'tt-near-overdue tt-near-overdue-blink'
                        : isNearOverdue
                          ? 'tt-near-overdue'
                          : undefined
                  )}
                >
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
                            <span className="inline-flex items-center rounded-full bg-red-700 text-red-200 border border-red-700 px-2 py-0.5 text-[11px] font-extrabold tracking-wider">
                              OVERDUE {formatOverdueShort(overdueMs)}
                            </span>
                          )}
                          {r.temporaryAt && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 px-2 py-0.5 text-[10px] font-extrabold">
                              <AlertTriangle className="h-3 w-3" />
                              TEMPORARY
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-200">
                          <span
                            role="link"
                            className="cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              void openDetail(r)
                            }}
                          >
                            {r.customerName}
                          </span>
                        </div>
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
                          <button
                            type="button"
                            onClick={() => {
                              void openDetail(r)
                            }}
                            className="text-left font-semibold text-blue-300 hover:underline"
                          >
                            {r.customerName}
                          </button>
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
                            'rounded-md border border-gray-300 bg-gray-100 px-3 py-3 text-center text-sm font-medium text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
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
                          className="rounded-md border border-gray-300 bg-gray-100 px-3 py-3 text-center text-sm font-medium text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {!isClosed && !r.temporaryAt && (
                          <button
                            type="button"
                            onClick={() => handleTemporaryTicket(r)}
                            className="inline-flex items-center gap-2 rounded-md bg-yellow-50 text-yellow-700 px-3 py-2 text-xs font-semibold hover:bg-yellow-100 border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:hover:bg-yellow-950 dark:border-yellow-800"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Temporary
                          </button>
                        )}
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
        <div className="space-y-2 md:hidden">
          {loading ? (
            <Card className="px-4 py-6 text-center text-sm text-ink-muted">
              Memuat...
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                compact
                title={supportsTroubleTicketWorkflow ? 'Tidak ada data' : 'Belum ada data untuk divisi ini di modul Trouble Ticket'}
              />
            </Card>
          ) : (
            rows.map((r) => {
              const wa = normalizeWaNumber(r.waNumber)
              const mapsLink = (r.mapsUrl || '').trim()
              const isClosed = (r.status || '').toUpperCase() === 'CLOSE' || !!r.closedAt
              const code = getDisplayTicketId(r)
              const openedAtMs = new Date(r.openedAt).getTime()
              const durationMs = Number.isFinite(openedAtMs) ? getTicketEndMs(r, now) - openedAtMs : NaN
              const typeKey = normalizeTypeKey(r.type)
              const dueAtMs = Number.isFinite(openedAtMs) ? openedAtMs + (slaDays[typeKey] ?? 1) * 24 * 60 * 60 * 1000 : NaN
              const overdueMs = Number.isFinite(dueAtMs) ? getTicketEndMs(r, now) - dueAtMs : 0
              const isOverdue = !isClosed && Number.isFinite(dueAtMs) && overdueMs > 0

              return (
                <Card
                  key={r.id}
                  className={clsx(
                    'overflow-hidden p-0',
                    isOverdue && 'tt-near-overdue tt-near-overdue-blink border-red-300 dark:border-red-800',
                    !isOverdue && r.temporaryAt && 'border-amber-300 dark:border-amber-800',
                    !isOverdue && repeatedUserSet.has(String(r.user ?? '').trim().toLowerCase()) && 'border-orange-400 dark:border-orange-700'
                  )}
                >
                  <div className="flex items-start gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(r.id)}
                      onChange={() => toggleRowSelected(r.id)}
                      aria-label={`Pilih ${r.customerName || code}`}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => setMobileExpandedId((prev) => (prev === r.id ? null : r.id))}
                      aria-expanded={mobileExpandedId === r.id}
                      aria-label={`${mobileExpandedId === r.id ? 'Tutup' : 'Buka'} detail ${code}`}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      {isOverdue || r.temporaryAt ? (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                      ) : isClosed ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      ) : (
                        <ArrowUp className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">
                          <span>{code} · {formatDateTime(r.openedAt)}</span>
                          <span className={clsx(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold',
                            isClosed
                              ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                              : r.temporaryAt
                                ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          )}>
                            {isClosed ? 'CLOSE' : r.temporaryAt ? 'TEMPORARY' : 'OPEN'}
                          </span>
                          {isOverdue && (
                            <span className="inline-flex rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-extrabold text-white">
                              OVERDUE {formatOverdueShort(overdueMs)}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block break-words text-sm font-semibold text-ink">{r.customerName}</span>
                        <span className="mt-1 block truncate text-xs text-ink-muted">
                          {(r.problemCategory || formatTypeLabel(r.type)).trim() || '-'} · {(r.user || '').trim() || '-'}
                        </span>
                      </span>
                      <span className="pt-0.5 text-ink-muted">
                        {mobileExpandedId === r.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </span>
                    </button>
                  </div>

                  {mobileExpandedId === r.id && (
                  <div className="border-t border-line px-3 pb-3 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-200">
                    <div className="min-w-0">
                      <div className="text-[11px] text-ink-muted">Type</div>
                      <div className="font-semibold break-words">{formatTypeLabel(r.type)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-ink-muted">No WA</div>
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
                      <div className="text-[11px] text-ink-muted">Gangguan</div>
                      <div className="font-semibold break-words">{(r.problemCategory || '').trim() || '-'}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-ink-muted">ONT</div>
                      <div className="font-semibold break-words">{(r.ont || '').trim() || '-'}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-ink-muted">Durasi</div>
                      <div className="font-semibold break-words">{formatDurationMs(durationMs)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-ink-muted">Open</div>
                      <div className="font-semibold break-words">{formatDateTime(r.openedAt)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-ink-muted">Close</div>
                      <div className="font-semibold break-words">{formatDateTime(r.closedAt || r.temporaryAt)}</div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[11px] text-ink-muted">Tindakan</div>
                      <div className="font-semibold break-words">{(r.resolutionAction || '').trim() || '-'}</div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[11px] text-ink-muted">Keterangan</div>
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
                        className="inline-flex items-center gap-2 rounded-md bg-blue-50 text-blue-700 px-3 py-2 text-xs font-semibold hover:bg-blue-100 border border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-950 dark:border-blue-800"
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
                  )}
                </Card>
              )
            })
          )}
        </div>

        <Card className="hidden md:block">
          <div className="mp-table-enhanced overflow-x-auto">
            <table className="w-full min-w-[1000px] table-auto">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selectedSet.has(r.id))}
                  onChange={toggleSelectAllCurrent}
                />
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">ID Ticket</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Nama Pelanggan</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">User</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">No WA</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Type</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Gangguan</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Status</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Durasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink-muted">
                  Memuat...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6">
                  <EmptyState
                    compact
                    title={supportsTroubleTicketWorkflow ? 'Tidak ada data' : 'Belum ada data untuk divisi ini di modul Trouble Ticket'}
                  />
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const openedAtMs = new Date(r.openedAt).getTime()
                const durationMs = Number.isFinite(openedAtMs) ? getTicketEndMs(r, now) - openedAtMs : NaN
                const wa = normalizeWaNumber(r.waNumber)
                const mapsLink = (r.mapsUrl || '').trim()
                const odpInfo = r.odpId ? odps.find((odp) => odp.id === r.odpId) ?? null : null
                const odpLocation = String(odpInfo?.lokasi ?? '').trim()
                const odpMapsHref = odpInfo
                  ? typeof odpInfo.latitude === 'number' && typeof odpInfo.longitude === 'number'
                    ? `https://www.google.com/maps?q=${odpInfo.latitude},${odpInfo.longitude}`
                    : normalizeMapsLink(odpLocation)
                  : ''
                const isClosed = (r.status || '').toUpperCase() === 'CLOSE' || !!r.closedAt
                const statusLabel = isClosed ? 'Close' : r.temporaryAt ? 'Temporary' : 'Open'
                const userKey = String(r.user ?? '').trim().toLowerCase()
                const isRepeatedUser = !!userKey && repeatedUserSet.has(userKey)
                const typeKey = normalizeTypeKey(r.type)
                const sla = slaDays[typeKey] ?? 1
                const dueAtMs = Number.isFinite(openedAtMs) ? openedAtMs + sla * 24 * 60 * 60 * 1000 : NaN
                const remainingMs = dueAtMs - now
                const isOverdue = !isClosed && Number.isFinite(dueAtMs) && remainingMs <= 0
                const isNearOverdue = !isClosed && Number.isFinite(dueAtMs) && remainingMs > 0 && remainingMs <= 6 * 60 * 60 * 1000
                const isVeryNearOverdue = !isClosed && Number.isFinite(dueAtMs) && remainingMs > 0 && remainingMs <= 60 * 60 * 1000

                return (
                  <Fragment key={r.id}>
                    <tr
                      className={clsx(
                        isRepeatedUser ? 'bg-orange-50 dark:bg-orange-950/35' : undefined,
                        'hover:bg-gray-50 dark:hover:bg-gray-700',
                        isOverdue
                          ? 'tt-near-overdue tt-near-overdue-blink'
                          : isVeryNearOverdue
                            ? 'tt-near-overdue tt-near-overdue-blink'
                            : isNearOverdue
                              ? 'tt-near-overdue'
                              : undefined
                      )}
                    >
                      <td className="px-3 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(r.id)}
                          onChange={() => toggleRowSelected(r.id)}
                        />
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-ink">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedId((prev) => (prev === r.id ? null : r.id))}
                            className="text-gray-500 hover:text-blue-600 dark:text-white dark:hover:text-blue-300 focus:outline-none"
                            aria-label={expandedId === r.id ? 'Tutup detail ticket' : 'Buka detail ticket'}
                            aria-expanded={expandedId === r.id}
                          >
                            {expandedId === r.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <span>{getDisplayTicketId(r)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200">
                        {r.customerName}
                      </td>
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
                          <span className="text-ink-muted">{r.waNumber || '-'}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200">{formatTypeLabel(r.type)}</td>
                      <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200">{(r.problemCategory || '').trim() || '-'}</td>
                      <td className="px-3 py-3 text-sm">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold',
                            isClosed
                              ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                              : r.temporaryAt
                                ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          )}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDurationMs(durationMs)}</td>
                    </tr>
                    {expandedId === r.id && (
                      <tr>
                        <td colSpan={9} className="px-3 pb-4">
                          <Card variant="muted" className="p-4">
                            <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
                              <TroubleTicketDetailSection
                                title="Detail Tiket"
                                rows={[
                                  {
                                    label: 'In Maps',
                                    value: mapsLink ? (
                                      <a href={mapsLink} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                                        Buka Lokasi
                                      </a>
                                    ) : '-',
                                  },
                                  { label: 'Open', value: formatDateTime(r.openedAt) },
                                  { label: 'Close', value: formatDateTime(r.closedAt) },
                                  {
                                    label: 'Ditutup Oleh',
                                    value: closeByLoadingId === r.id ? 'Memuat...' : (closeByMap[r.id] ?? r.closeBy ?? '-'),
                                  },
                                ]}
                              />
                              <TroubleTicketDetailSection
                                title="Data Teknis"
                                rows={[
                                  { label: 'Paket', value: (r.paket || '').trim() || '-' },
                                  { label: 'ONT', value: (r.ont || '').trim() || '-' },
                                  {
                                    label: 'ODP',
                                    value: odpInfo?.nama_odp ?? (r.odpId ? String(r.odpId) : '-'),
                                  },
                                  { label: 'Port ODP', value: r.portNumber == null ? '-' : String(r.portNumber) },
                                  {
                                    label: 'Lokasi ODP',
                                    value: odpMapsHref ? (
                                      <a href={odpMapsHref} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                                        {odpLocation || 'Buka Lokasi ODP'}
                                      </a>
                                    ) : '-',
                                  },
                                  { label: 'Serial Number', value: (r.sn || '').trim() || '-' },
                                ]}
                              />
                            </div>
                            <div className="mt-4">
                              <TroubleTicketDetailSection
                                title="Keterangan & Penanganan"
                                rows={[
                                  { label: 'Tindakan', value: (r.resolutionAction || '').trim() || '-' },
                                  { label: 'Keterangan', value: (r.notes || '').trim() || '-' },
                                  ...(r.closeNotes?.trim() ? [{ label: 'Catatan Penutupan', value: r.closeNotes.trim() }] : []),
                                ]}
                              />
                            </div>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="text-sm text-gray-700 dark:text-gray-200">
                                <div className="flex items-center gap-2 font-semibold">
                                  <span>Aksi Ticket</span>
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
                                  className="inline-flex items-center gap-2 rounded-md bg-blue-50 text-blue-700 px-3 py-2 text-xs font-semibold hover:bg-blue-100 border border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-950 dark:border-blue-800"
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
                                {!isClosed && !r.temporaryAt && (
                                  <button
                                    type="button"
                                    onClick={() => handleTemporaryTicket(r)}
                                    className="inline-flex items-center gap-2 rounded-md bg-yellow-50 text-yellow-700 px-3 py-2 text-xs font-semibold hover:bg-yellow-100 border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:hover:bg-yellow-950 dark:border-yellow-800"
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                    Temporary
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.location.href = `/trouble-ticket/close/${r.id}`
                                  }}
                                  disabled={isClosed}
                                  className="inline-flex items-center gap-2 rounded-md bg-green-50 text-green-700 px-3 py-2 text-xs font-semibold hover:bg-green-100 border border-green-200 disabled:opacity-50 dark:bg-green-950 dark:text-green-200 dark:hover:bg-green-950 dark:border-green-800"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Close
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTicket(r.id)}
                                  disabled={deletingId === r.id}
                                  className="inline-flex items-center gap-2 rounded-md bg-red-50 text-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-100 border border-red-200 disabled:opacity-50 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-950 dark:border-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {deletingId === r.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </Card>
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
        </Card>

        <Card className="px-3 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              {total > 0 ? `Menampilkan ${pageStart}–${pageEnd} dari ${total} data` : 'Tidak ada data'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">Tampil</span>
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
        </Card>
      </div>
      )}

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/80 px-4 py-6 backdrop-blur-sm"
          onClick={closeCreateModal}
        >
          <div className="flex min-h-full items-start justify-center sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Buat Trouble Ticket"
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                <SectionHeading
                  title="Buat Trouble Ticket"
                  description="Isi data gangguan atau preventive secara singkat dan jelas."
                />
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  aria-label="Tutup popup create ticket"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[calc(100vh-11rem)] overflow-y-auto px-5 py-4 space-y-3">
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                ID Ticket otomatis: {idPrefix}{formatTicketNumber(nextNumber)}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Kategori</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as 'TT' | 'PV' })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="TT">Trouble Ticket (TT)</option>
                    <option value="PV">Preventive (PV)</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama Pelanggan</span>
                  <input
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">User</span>
                  <input
                    value={form.user}
                    onChange={(e) => setForm({ ...form, user: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">No WA</span>
                  <input
                    value={form.waNumber}
                    onChange={(e) => setForm({ ...form, waNumber: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Link Maps</span>
                  <input
                    value={form.mapsUrl}
                    onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="https://maps.google.com/..."
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Type</span>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    disabled={form.category === 'PV'}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Paket</span>
                  <input
                    type="text"
                    value={form.paket}
                    onChange={(e) => setForm({ ...form, paket: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Contoh: HOME LITE / HOME MINI / GMBG-08-03 / PTI1-13-12"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">ONT</span>
                  <select
                    value={form.ont}
                    onChange={(e) => setForm({ ...form, ont: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Pilih ONT...</option>
                    {ontOptions.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Jenis Gangguan</span>
                  <select
                    value={form.problemCategory}
                    onChange={(e) => setForm({ ...form, problemCategory: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Pilih ODP</span>
                  <select
                    value={form.odpId || ''}
                    onChange={(e) => setForm({ ...form, odpId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">-- Pilih ODP --</option>
                    {odps.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nama_odp} ({o.wilayah})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Port ODP</span>
                  <input
                    type="number"
                    value={form.portNumber || ''}
                    onChange={(e) => setForm({ ...form, portNumber: e.target.value ? Number(e.target.value) : null })}
                    placeholder="1-128"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">SN (Serial Number)</span>
                  <input
                    type="text"
                    value={form.sn || ''}
                    onChange={(e) => setForm({ ...form, sn: e.target.value })}
                    placeholder="ZTEG / FHTT..."
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="min-h-[90px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
                <button
                  onClick={closeCreateModal}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  onClick={handleCreate}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/80 px-4 py-6 backdrop-blur-sm"
          onClick={closeEditModal}
        >
          <div className="flex min-h-full items-start justify-center sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Edit Trouble Ticket"
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                <SectionHeading
                  title="Edit Trouble Ticket"
                  description="Perbarui data inti tiket tanpa mengubah alur kerja."
                />
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  aria-label="Tutup popup edit ticket"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[calc(100vh-11rem)] overflow-y-auto px-5 py-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama Pelanggan</span>
                  <input
                    value={editForm.customerName}
                    onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">User</span>
                  <input
                    value={editForm.user}
                    onChange={(e) => setEditForm({ ...editForm, user: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">No WA</span>
                  <input
                    value={editForm.waNumber}
                    onChange={(e) => setEditForm({ ...editForm, waNumber: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Link Maps</span>
                  <input
                    value={editForm.mapsUrl}
                    onChange={(e) => setEditForm({ ...editForm, mapsUrl: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="https://maps.google.com/..."
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Type</span>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Paket</span>
                  <input
                    type="text"
                    value={editForm.paket}
                    onChange={(e) => setEditForm({ ...editForm, paket: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Contoh: HOME LITE / HOME MINI / GMBG-08-03 / PTI1-13-12"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">ONT</span>
                  <select
                    value={editForm.ont}
                    onChange={(e) => setEditForm({ ...editForm, ont: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Pilih ONT...</option>
                    {ontOptions.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Jenis Gangguan</span>
                  <select
                    value={editForm.problemCategory}
                    onChange={(e) => setEditForm({ ...editForm, problemCategory: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</span>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'OPEN' | 'CLOSE' })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSE">CLOSE</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Pilih ODP</span>
                  <select
                    value={editForm.odpId || ''}
                    onChange={(e) => setEditForm({ ...editForm, odpId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">-- Pilih ODP --</option>
                    {odps.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nama_odp} ({o.wilayah})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Port ODP</span>
                  <input
                    type="number"
                    value={editForm.portNumber || ''}
                    onChange={(e) => setEditForm({ ...editForm, portNumber: e.target.value ? Number(e.target.value) : null })}
                    placeholder="1-128"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">SN (Serial Number)</span>
                  <input
                    type="text"
                    value={editForm.sn || ''}
                    onChange={(e) => setEditForm({ ...editForm, sn: e.target.value })}
                    placeholder="ZTEG / FHTT..."
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan</span>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="min-h-[90px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
                <button
                  onClick={closeEditModal}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  onClick={handleUpdate}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailRow && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/80 px-4 py-6 backdrop-blur-sm"
          onClick={closeDetailModal}
        >
          <div className="flex min-h-full items-start justify-center sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Rincian Trouble Ticket"
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <SectionHeading
                  title="Rincian Trouble Ticket"
                  description="Salin, kirim, atau lihat lampiran tiket dari satu tempat."
                />
                {detailRow.temporaryAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 px-2 py-0.5 text-[11px] font-extrabold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    TEMPORARY
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto px-5 py-4 space-y-3">
              <textarea
                readOnly
                value={detailText}
                className="w-full min-h-[220px] rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                {(((detailRow.status || '').toUpperCase() === 'CLOSE' || !!detailRow.closedAt) &&
                  (Number(detailRow.closePhotosCount || 0) > 0 ||
                    (Array.isArray(detailRow.closePhotoUrls) && detailRow.closePhotoUrls.length > 0) ||
                    (Array.isArray(detailRow.closePhotos) && detailRow.closePhotos.length > 0))) && (
                    <>
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
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                        disabled={detailFetching}
                      >
                        Lihat
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!detailRow) return
                          const hasUrls = Array.isArray(detailRow.closePhotoUrls)
                          const hasLegacy = Array.isArray(detailRow.closePhotos)
                          if (!hasUrls && !hasLegacy) {
                            await ensureDetailPhotos(detailRow.id)
                          }
                          downloadAllPhotos()
                        }}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                        disabled={detailFetching}
                      >
                        Download Semua Foto
                      </button>
                    </>
                )}
                <button
                  type="button"
                  onClick={handleShareWa}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                  disabled={detailFetching}
                >
                  Kirim ke WA
                </button>
                <button
                  type="button"
                  onClick={handleCopyDetail}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  disabled={detailFetching}
                >
                  <Clipboard className="h-4 w-4" />
                  {copied ? 'Tercopy' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {detailRow && isPhotoViewerOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/85 px-4 py-6 backdrop-blur-sm"
          onClick={closePhotoViewer}
        >
          <div className="flex min-h-full items-start justify-center sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Foto Lokasi"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <SectionHeading title="Foto Lokasi" />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadAllPhotos}
                  className="rounded-md bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 text-sm font-medium"
                >
                  Download Semua
                </button>
                <button
                  type="button"
                  onClick={closePhotoViewer}
                  className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto px-5 py-4">
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
        </div>
      )}
    </div>
  )
}
