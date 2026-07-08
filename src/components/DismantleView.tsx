'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { CheckCircle2, ChevronDown, ChevronUp, Clipboard, Download, Info, Pencil, Trash2, Upload } from 'lucide-react'
import { formatSuspendDuration } from '@/lib/isolation-suspend'
import { canDeleteIsolationRecords, canMutateMenu, canUseAdminIsolationDismantleScope } from '@/lib/access'

type DivisionFilter = 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'
type TicketFilter = 'ALL' | 'WITH' | 'WITHOUT'
type DismantleStatusFilter = 'OPEN' | 'CLOSED'

type DismantleItem = {
  id: number
  sourceIsolationId?: number | null
  customerName: string
  customerAddress: string | null
  customerPhone: string | null
  userEmail?: string | null
  marketing?: string | null
  radboox?: string | null
  isolationDate: string
  reason?: string | null
  fieldNote?: string | null
  status: string
  ticketDismantle?: string | null
  ticketId?: number | null
  closeNote?: string | null
  closePhoto?: string | null
  closedAt?: string | null
  closedBy?: string | null
  ticket?: {
    locationMap?: string | null
    description?: string | null
  } | null
}

type DismantleResponse = {
  items?: DismantleItem[]
  total?: number
  withTicketTotal?: number
  withoutTicketTotal?: number
  error?: string
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getRowTone(row: DismantleItem) {
  const hasTicket = String(row.ticketDismantle ?? '').trim() !== ''
  const note = String(row.reason ?? '').toLowerCase()
  const status = String(row.status ?? '').toUpperCase()
  const needsAttention =
    note.includes('belum') ||
    note.includes('pending') ||
    note.includes('tagihan') ||
    note.includes('belum dibayar') ||
    note.includes('masih') ||
    note.includes('dilanjut')

  if (needsAttention || (status === 'OPEN' && !hasTicket)) {
    return 'bg-red-100 dark:bg-red-900'
  }
  if (!hasTicket) {
    return 'bg-yellow-100 dark:bg-yellow-900'
  }
  return 'bg-green-100 dark:bg-green-900'
}

function getCellTextTone(row: DismantleItem) {
  const note = String(row.reason ?? '').toLowerCase()
  const status = String(row.status ?? '').toUpperCase()
  const needsAttention =
    note.includes('belum') ||
    note.includes('pending') ||
    note.includes('tagihan') ||
    note.includes('belum dibayar') ||
    note.includes('masih') ||
    note.includes('dilanjut')
  if (needsAttention || (status === 'OPEN' && String(row.ticketDismantle ?? '').trim() === '')) {
    return 'text-red-900 dark:text-red-100'
  }
  return 'text-gray-900 dark:text-white'
}

function getTicketBadgeTone(hasTicket: boolean) {
  return hasTicket
    ? 'bg-green-700 text-white dark:bg-green-600'
    : 'bg-orange-500 text-white dark:bg-orange-500'
}

function getStatusBadgeTone(status: string) {
  return String(status).toUpperCase() === 'OPEN'
    ? 'bg-red-700 text-white dark:bg-red-600'
    : 'bg-green-700 text-white dark:bg-green-600'
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalizeWaNumber(input: string) {
  const digits = String(input || '').replace(/\D/g, '')
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

function buildDismantleDetailText(row: DismantleItem) {
  const maps = String(row.ticket?.locationMap ?? '').trim()
  const problem = String(row.ticket?.description ?? row.radboox ?? '').trim()
  const closeNote = String(row.closeNote ?? '').trim()
  const fieldNote = String(row.fieldNote ?? '').trim()
  const lines = [
    `ID DATA : ${row.id}`,
    `NO TICKET : ${String(row.ticketDismantle ?? '').trim() || '-'}`,
    `Nama : ${row.customerName || '-'}`,
    `User : ${row.userEmail || row.marketing || '-'}`,
    `No WA : ${row.customerPhone || '-'}`,
    `In Maps : ${maps || '-'}`,
    `Alamat : ${row.customerAddress || '-'}`,
    `Suspend : ${formatSuspendDuration(row.isolationDate)}`,
    `Problem : ${problem || '-'}`,
    `Keterangan : ${row.reason || `Isolir sejak ${formatDate(row.isolationDate)}`}`,
    `Keterangan Lapangan : ${fieldNote || '-'}`,
    `Keterangan Close : ${closeNote || '-'}`,
    `Ditutup : ${formatDateTime(row.closedAt)}`,
    `Closed By : ${String(row.closedBy ?? '').trim() || '-'}`,
    `Status : ${String(row.status || '-').toUpperCase()}`,
  ]
  return lines.join('\n')
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-4">
      <div className="absolute inset-0 bg-gray-900" onClick={onClose} />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Tutup
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}

export function DismantleView({
  userRole,
  initialDivision = 'CS_ADMIN',
  initialStatus = 'OPEN',
}: {
  userRole: string
  initialDivision?: DivisionFilter
  initialStatus?: DismantleStatusFilter
}) {
  const roleUpper = (userRole || '').toUpperCase()
  const canUseAdminScope = canUseAdminIsolationDismantleScope(roleUpper)
  const isDismantleRole = roleUpper === 'DISMANTLE'
  const canEdit = canMutateMenu(roleUpper, 'dismantle')
  const canBulkDelete = canDeleteIsolationRecords(roleUpper)

  const [division, setDivision] = useState<DivisionFilter>(initialDivision)
  const [statusFilter, setStatusFilter] = useState<DismantleStatusFilter>(initialStatus)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>('ALL')
  const [radbooxFilter, setRadbooxFilter] = useState('ALL')
  const [rows, setRows] = useState<DismantleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [total, setTotal] = useState(0)
  const [withTicketTotal, setWithTicketTotal] = useState<number | null>(null)
  const [withoutTicketTotal, setWithoutTicketTotal] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedRow, setSelectedRow] = useState<DismantleItem | null>(null)
  const [ticketValue, setTicketValue] = useState('')
  const [statusValue, setStatusValue] = useState<DismantleStatusFilter>(initialStatus)
  const [customerNameValue, setCustomerNameValue] = useState('')
  const [userEmailValue, setUserEmailValue] = useState('')
  const [marketingValue, setMarketingValue] = useState('')
  const [phoneValue, setPhoneValue] = useState('')
  const [mapsValue, setMapsValue] = useState('')
  const [addressValue, setAddressValue] = useState('')
  const [reasonValue, setReasonValue] = useState('')
  const [fieldNoteValue, setFieldNoteValue] = useState('')
  const [problemValue, setProblemValue] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detailRow, setDetailRow] = useState<DismantleItem | null>(null)
  const [copied, setCopied] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isDeletingSelected, setIsDeletingSelected] = useState(false)
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [closeRow, setCloseRow] = useState<DismantleItem | null>(null)
  const [closeNote, setCloseNote] = useState('')
  const [closePhotoFile, setClosePhotoFile] = useState<File | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const supportsWorkflow =
    (!canUseAdminScope || division === 'ALL' || division === 'CS_ADMIN') &&
    (!isDismantleRole || division === 'CS_ADMIN')
  const statusLabel = statusFilter === 'OPEN' ? 'Open' : 'Close'
  const isClosedView = statusFilter === 'CLOSED'
  const effectiveTicketFilter: TicketFilter = ticketFilter

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setDivision(initialDivision)
  }, [initialDivision])

  useEffect(() => {
    setStatusFilter(initialStatus)
    setStatusValue(initialStatus)
    setTicketFilter('ALL')
  }, [initialStatus])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, division, limit, radbooxFilter, statusFilter, ticketFilter])

  const buildQueryParams = useCallback(
    (targetPage: number, targetLimit: number) => {
      const params = new URLSearchParams()
      params.set('page', String(targetPage))
      params.set('limit', String(targetLimit))
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (radbooxFilter !== 'ALL') params.set('radboox', radbooxFilter)
      if (effectiveTicketFilter !== 'ALL') params.set('ticketStatus', effectiveTicketFilter)
      return params
    },
    [debouncedSearch, effectiveTicketFilter, radbooxFilter]
  )

  const requestRows = useCallback(
    async (targetPage: number, targetLimit: number, signal?: AbortSignal) => {
      const endpoint = isClosedView ? '/api/dismantle-history' : '/api/dismantle-tickets'
      const res = await fetch(`${endpoint}?${buildQueryParams(targetPage, targetLimit).toString()}`, {
        cache: 'no-store',
        signal,
      })
      const data = (await res.json().catch(() => ({}))) as DismantleResponse
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data dismantle')
      return {
        items: Array.isArray(data.items) ? data.items : [],
        total: typeof data.total === 'number' ? data.total : 0,
        withTicketTotal: typeof data.withTicketTotal === 'number' ? data.withTicketTotal : null,
        withoutTicketTotal: typeof data.withoutTicketTotal === 'number' ? data.withoutTicketTotal : null,
      }
    },
    [buildQueryParams, isClosedView]
  )

  const fetchRows = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await requestRows(page, limit, signal)
      setRows(data.items)
      setTotal(data.total)
      if (!isClosedView && data.withTicketTotal != null && data.withoutTicketTotal != null) {
        setWithTicketTotal(data.withTicketTotal)
        setWithoutTicketTotal(data.withoutTicketTotal)
      } else {
        setWithTicketTotal(null)
        setWithoutTicketTotal(null)
      }
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : String(err))
      setRows([])
      setTotal(0)
      setWithTicketTotal(null)
      setWithoutTicketTotal(null)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [isClosedView, limit, page, requestRows])

  useEffect(() => {
    const controller = new AbortController()
    void fetchRows(controller.signal)
    return () => controller.abort()
  }, [fetchRows])

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ register?: (promise: Promise<unknown>) => void }>
      const task = fetchRows()
      custom.detail?.register?.(task)
    }
    window.addEventListener('app:refresh', handler)
    return () => window.removeEventListener('app:refresh', handler)
  }, [fetchRows])

  const filledCountOnPage = useMemo(
    () => rows.filter((row) => String(row.ticketDismantle ?? '').trim() !== '').length,
    [rows]
  )
  const emptyCountOnPage = rows.length - filledCountOnPage
  const filledCount = !isClosedView && withTicketTotal != null ? withTicketTotal : filledCountOnPage
  const emptyCount = !isClosedView && withoutTicketTotal != null ? withoutTicketTotal : emptyCountOnPage
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const showSelection = canBulkDelete && supportsWorkflow
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allOnPageSelected = showSelection && rows.length > 0 && rows.every((x) => selectedSet.has(x.id))

  useEffect(() => {
    if (!showSelection) {
      if (selectedIds.length > 0) setSelectedIds([])
      return
    }
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev
      const current = new Set(rows.map((x) => x.id))
      return prev.filter((id) => current.has(id))
    })
  }, [rows, selectedIds.length, showSelection])

  const toggleSelected = (id: number) => {
    if (!showSelection) return
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAllOnPage = () => {
    if (!showSelection) return
    const pageIds = rows.map((x) => x.id)
    setSelectedIds((prev) => {
      const prevSet = new Set(prev)
      const allSelected = pageIds.length > 0 && pageIds.every((id) => prevSet.has(id))
      if (allSelected) {
        return prev.filter((id) => !pageIds.includes(id))
      }
      for (const id of pageIds) prevSet.add(id)
      return Array.from(prevSet)
    })
  }

  const deleteSelected = async () => {
    if (!showSelection) return
    if (selectedIds.length === 0) return
    if (!confirm(`Hapus ${selectedIds.length} data yang dipilih${isClosedView ? ' dari histori close' : ''}?`)) return
    setIsDeletingSelected(true)
    try {
      const ids = [...selectedIds]
      const endpoint = isClosedView ? '/api/dismantle-history' : '/api/dismantle-tickets'
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = (await res.json().catch(() => ({}))) as { count?: number; error?: string }
      if (!res.ok) throw new Error(data.error || `Gagal menghapus data ${isClosedView ? 'histori close' : 'terpilih'}`)
      alert(`Berhasil menghapus ${data.count ?? ids.length} data${isClosedView ? ' histori close' : ''}`)
      setSelectedIds([])
      await fetchRows()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menghapus data')
      await fetchRows()
    } finally {
      setIsDeletingSelected(false)
    }
  }

  const openEdit = (row: DismantleItem) => {
    setSelectedRow(row)
    setTicketValue(String(row.ticketDismantle ?? ''))
    setStatusValue('OPEN')
    setCustomerNameValue(String(row.customerName ?? ''))
    setUserEmailValue(String(row.userEmail ?? ''))
    setMarketingValue(String(row.marketing ?? ''))
    setPhoneValue(String(row.customerPhone ?? ''))
    setMapsValue(String(row.ticket?.locationMap ?? ''))
    setAddressValue(String(row.customerAddress ?? ''))
    setReasonValue(String(row.reason ?? ''))
    setFieldNoteValue(String(row.fieldNote ?? ''))
    setProblemValue(String(row.ticket?.description ?? row.radboox ?? ''))
    setModalOpen(true)
  }

  const saveTicket = async () => {
    if (!selectedRow) return
    setSaving(true)
    try {
      const isolationRes = await fetch(`/api/dismantle-tickets/${selectedRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerNameValue,
          userEmail: userEmailValue,
          marketing: marketingValue,
          customerPhone: phoneValue,
          customerAddress: addressValue,
          reason: reasonValue,
          fieldNote: fieldNoteValue,
          radboox: problemValue,
          ticketNumber: ticketValue,
          status: 'OPEN',
        }),
      })
      const isolationData = (await isolationRes.json().catch(() => ({}))) as { error?: string }
      if (!isolationRes.ok) throw new Error(isolationData.error || 'Gagal menyimpan perubahan')

      setModalOpen(false)
      setSelectedRow(null)
      await fetchRows()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    if (!supportsWorkflow) return
    setIsExporting(true)
    try {
      const XLSX = await import('xlsx')
      const batchLimit = 100
      const collected: DismantleItem[] = []
      let exportPage = 1
      let exportTotal = 0

      while (true) {
        const data = await requestRows(exportPage, batchLimit)
        exportTotal = data.total
        collected.push(...data.items)
        if (data.items.length < batchLimit || collected.length >= exportTotal) break
        exportPage += 1
      }

      const rowsToExport = collected.map((row) => ({
        'ID Histori': row.id,
        'Referensi Isolir': row.sourceIsolationId ?? (isClosedView ? '-' : row.id),
        'Nomor Ticket': String(row.ticketDismantle ?? '').trim(),
        'Nama': row.customerName || '',
        'User': row.userEmail || row.marketing || '',
        'No. HP': row.customerPhone || '',
        'Maps': row.ticket?.locationMap || '',
        'Alamat': row.customerAddress || '',
        'Keterangan': row.reason || '',
        'Problem': row.ticket?.description || row.radboox || '',
        'Status': row.status || '',
        'Ditutup Pada': row.closedAt ? formatDateTime(row.closedAt) : '-',
        'Closed By': row.closedBy || '-',
      }))

      const worksheet = XLSX.utils.json_to_sheet(rowsToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Dismantle')
      XLSX.writeFile(workbook, `Dismantle_Perangkat_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal export Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    if (!canEdit || !supportsWorkflow || isImporting) return
    fileInputRef.current?.click()
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const endpoint = isClosedView ? '/api/dismantle-history/import' : '/api/dismantle-tickets/import'
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string; errors?: string[] }
      if (!res.ok) {
        throw new Error(data.error || 'Gagal import Excel')
      }

      const details = Array.isArray(data.errors) && data.errors.length > 0 ? `\n\n${data.errors.join('\n')}` : ''
      alert(`${data.message || 'Import selesai'}${details}`)
      await fetchRows()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal import Excel')
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  const openDetail = (row: DismantleItem) => {
    setDetailRow(row)
    setCopied(false)
  }

  const handleCopyDetail = async () => {
    if (!detailRow) return
    try {
      await navigator.clipboard.writeText(buildDismantleDetailText(detailRow))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      alert('Gagal copy ke clipboard')
    }
  }

  const handleShareWa = () => {
    if (!detailRow) return
    const url = `https://wa.me/?text=${encodeURIComponent(buildDismantleDetailText(detailRow))}`
    window.open(url, '_blank', 'noreferrer')
  }

  const openCloseForm = (row: DismantleItem) => {
    setCloseRow(row)
    setCloseNote('')
    setClosePhotoFile(null)
    setCloseModalOpen(true)
  }

  const submitClose = async () => {
    if (!closeRow) return
    setIsClosing(true)
    try {
      const form = new FormData()
      form.append('dismantleTicketId', String(closeRow.id))
      form.append('closeNote', closeNote)
      const existingTicket = String(closeRow.ticketDismantle ?? '').trim()
      if (existingTicket) form.append('ticketDismantle', existingTicket)
      if (closePhotoFile) form.append('closePhoto', closePhotoFile)

      const res = await fetch('/api/dismantle-history/close', {
        method: 'POST',
        body: form,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal close ticket')

      setCloseModalOpen(false)
      setCloseRow(null)
      setCloseNote('')
      setClosePhotoFile(null)
      await fetchRows()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal close ticket')
    } finally {
      setIsClosing(false)
    }
  }

  const reopenHistory = async (row: DismantleItem) => {
    if (!canEdit) return
    setActionLoadingId(row.id)
    try {
      const res = await fetch(`/api/dismantle-history/${row.id}/reopen`, {
        method: 'POST',
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal membuka kembali histori dismantle')
      await fetchRows()
      if (detailRow?.id === row.id) {
        setDetailRow(null)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal membuka kembali histori dismantle')
    } finally {
      setActionLoadingId(null)
    }
  }

  if (isDismantleRole) {
    return (
      <div className="space-y-4 overflow-x-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportFile}
        />

        <div className="rounded-xl border border-gray-800 bg-black p-3 text-white">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid grid-cols-1 gap-3 md:flex md:flex-row md:items-end">
              <div className="flex flex-col">
                <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Cari</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-600 bg-black px-3 py-2 text-sm text-white focus:border-gray-400 focus:outline-none focus:ring-0 md:w-80"
                  placeholder="Nama / WA / alamat / problem"
                />
              </div>
              <div className="flex flex-col">
                <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as DismantleStatusFilter)}
                  className="w-full rounded-md border border-gray-600 bg-black px-3 py-2 text-sm text-white focus:border-gray-400 focus:outline-none focus:ring-0 md:w-40"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSE</option>
                </select>
              </div>
              <div className="flex flex-col">
                <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ticket</span>
                <select
                  value={effectiveTicketFilter}
                  onChange={(e) => setTicketFilter(e.target.value as TicketFilter)}
                  disabled={!isClosedView}
                  className="w-full rounded-md border border-gray-600 bg-black px-3 py-2 text-sm text-white focus:border-gray-400 focus:outline-none focus:ring-0 md:w-48"
                >
                  <option value="WITH">SUDAH ADA TICKET</option>
                  {isClosedView && <option value="ALL">SEMUA</option>}
                  {isClosedView && <option value="WITHOUT">BELUM ADA TICKET</option>}
                </select>
              </div>
            </div>

            <div className="rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-300">
              {isClosedView
                ? 'Riwayat close dismantle dibaca dari histori terpisah agar tidak terpengaruh penghapusan massal Isolir.'
                : 'Menu open hanya menampilkan data Isolir aktif yang sudah memiliki nomor ticket dismantle.'}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <div className="rounded-lg bg-black px-4 py-6 text-center text-sm text-white">Memuat...</div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg bg-black px-4 py-6 text-center text-sm text-white">Tidak ada data</div>
          ) : (
            rows.map((row) => {
              const isClosed = String(row.status ?? '').toUpperCase() === 'CLOSED'
              const ticketCode = String(row.ticketDismantle ?? '').trim() || `DSM-${row.id}`
              const headerLabel = String(row.ticketDismantle ?? '').trim()
                ? `${formatDateTime(row.isolationDate)} - ${ticketCode} - ${isClosed ? 'Close' : 'New'}`
                : `DSM - ${formatDateTime(row.isolationDate)} - ${ticketCode} - ${isClosed ? 'Close' : 'New'}`
              const mapsLink = String(row.ticket?.locationMap ?? '').trim()
              const normalizedWa = normalizeWaNumber(String(row.customerPhone ?? ''))
              const mapsHref = normalizeMapsLink(mapsLink)
              const detailText = String(row.ticket?.description ?? row.radboox ?? '').trim()

              return (
                <div key={row.id} className="rounded-lg border border-gray-800 bg-black text-white">
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === row.id ? null : row.id))}
                    className="w-full px-4 py-3 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-6 w-6 text-orange-400" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-bold tracking-wide">
                          <span>{headerLabel}</span>
                        </div>
                        <div className="mt-1 text-sm text-gray-200">{row.customerName || '-'}</div>
                        <div className="mt-1 text-xs text-gray-400">
                          {(detailText || '-')} {' • '} Suspend {formatSuspendDuration(row.isolationDate)}
                        </div>
                      </div>
                      <div className="pt-0.5 text-gray-300">
                        {expandedId === row.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </button>

                  {expandedId === row.id && (
                    <div className="px-4 pb-4">
                      <div className="mt-2 space-y-2 text-sm">
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">Nama Pelanggan</div>
                          <button
                            type="button"
                            onClick={() => openDetail(row)}
                            className="text-left font-semibold text-blue-300 hover:underline"
                          >
                            {row.customerName || '-'}
                          </button>
                        </div>
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">No Ticket</div>
                          <div className="font-semibold">{ticketCode}</div>
                        </div>
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">No WA</div>
                          {normalizedWa ? (
                            <a
                              href={`https://wa.me/${normalizedWa}`}
                              target="_blank"
                              rel="noreferrer"
                              className="break-words font-semibold text-blue-300 hover:underline"
                            >
                              {row.customerPhone}
                            </a>
                          ) : (
                            <div>{row.customerPhone || '-'}</div>
                          )}
                        </div>
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">Problem</div>
                          <div className="whitespace-pre-wrap break-words">{detailText || '-'}</div>
                        </div>
                        <div className="rounded-md bg-gray-900 px-3 py-2">
                          <div className="text-xs text-gray-400">Keterangan</div>
                          <div className="whitespace-pre-wrap break-words">
                            {row.reason || `Isolir sejak ${formatDate(row.isolationDate)} (${formatSuspendDuration(row.isolationDate)}).`}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <a
                          href={mapsHref || '#'}
                          target={mapsHref ? '_blank' : undefined}
                          rel={mapsHref ? 'noreferrer' : undefined}
                          className={clsx(
                            'rounded-md border border-gray-600 bg-gray-200 px-3 py-3 text-center text-sm font-medium text-gray-900',
                            !mapsHref && 'pointer-events-none opacity-50'
                          )}
                        >
                          View Location
                        </a>
                        {isClosed ? (
                          <button
                            type="button"
                            onClick={() => void reopenHistory(row)}
                            disabled={actionLoadingId === row.id}
                            className="rounded-md border border-gray-600 bg-gray-200 px-3 py-3 text-center text-sm font-medium text-gray-900 disabled:opacity-50"
                          >
                            {actionLoadingId === row.id ? 'Menyimpan...' : 'Open Kembali'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCloseForm(row)}
                            disabled={actionLoadingId === row.id}
                            className="rounded-md border border-gray-600 bg-gray-200 px-3 py-3 text-center text-sm font-medium text-gray-900 disabled:opacity-50"
                          >
                            {actionLoadingId === row.id ? 'Menyimpan...' : 'Close'}
                          </button>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openDetail(row)}
                          className="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-100 hover:bg-gray-700"
                        >
                          <Info className="h-4 w-4" />
                          Rincian
                        </button>
                        {!isClosed && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedId(null)
                              openEdit(row)
                            }}
                            className="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-100 hover:bg-gray-700"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                        )}
                        {!isClosed && (
                          <button
                            type="button"
                            onClick={() => openCloseForm(row)}
                            disabled={actionLoadingId === row.id}
                            className="inline-flex items-center gap-2 rounded-md border border-green-800 bg-green-950 px-3 py-2 text-xs font-semibold text-green-200 hover:bg-green-900 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Close
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="rounded-lg border border-gray-800 bg-black px-3 py-3 text-sm text-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>{total > 0 ? `Menampilkan ${rows.length} dari total ${total} data` : 'Tidak ada data'}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <div>Halaman {page}</div>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>

        <Modal
          open={!!detailRow}
          title={detailRow ? `Rincian Dismantle: ${detailRow.customerName}` : 'Rincian Dismantle'}
          onClose={() => setDetailRow(null)}
        >
          <div className="space-y-3">
            <textarea
              readOnly
              value={detailRow ? buildDismantleDetailText(detailRow) : ''}
              className="min-h-[220px] w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            {detailRow?.closePhoto && (
              <a href={detailRow.closePhoto} target="_blank" rel="noreferrer" className="block">
                <Image
                  src={detailRow.closePhoto}
                  alt="Foto Close"
                  width={1200}
                  height={800}
                  unoptimized
                  className="max-h-[320px] w-full rounded-md border border-gray-200 object-contain dark:border-gray-700"
                />
              </a>
            )}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
              <button
                type="button"
                onClick={handleShareWa}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                Kirim ke WA
              </button>
              <button
                type="button"
                onClick={handleCopyDetail}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              >
                <Clipboard className="h-4 w-4" />
                {copied ? 'Tercopy' : 'Copy'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={closeModalOpen}
          title={closeRow ? `Close Ticket: ${closeRow.customerName}` : 'Close Ticket'}
          onClose={() => {
            if (isClosing) return
            setCloseModalOpen(false)
            setCloseRow(null)
            setCloseNote('')
            setClosePhotoFile(null)
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan Close</label>
              <textarea
                rows={3}
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                placeholder="Contoh: Sudah diambil perangkat / sudah selesai / dll"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Upload Foto</label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setClosePhotoFile(e.target.files?.[0] || null)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Maksimal 3MB (jpg/png).</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCloseModalOpen(false)
                  setCloseRow(null)
                  setCloseNote('')
                  setClosePhotoFile(null)
                }}
                disabled={isClosing}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitClose}
                disabled={isClosing || !closeRow}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                {isClosing ? 'Menyimpan...' : 'Close Ticket'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={modalOpen}
          title={selectedRow ? `Ticket Dismantle: ${selectedRow.customerName}` : 'Ticket Dismantle'}
          onClose={() => {
            setModalOpen(false)
            setSelectedRow(null)
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Pelanggan</div>
                  <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">{selectedRow?.customerName || '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">No WA</div>
                  <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">{selectedRow?.customerPhone || '-'}</div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nomor Ticket Dismantle</label>
              <input
                value={ticketValue}
                onChange={(e) => setTicketValue(e.target.value)}
                placeholder="Contoh: DT/PKN/019/21.02.2026"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan Lapangan</label>
              <textarea
                rows={3}
                value={fieldNoteValue}
                onChange={(e) => setFieldNoteValue(e.target.value)}
                placeholder="Contoh: Perangkat belum bisa diambil karena rumah kosong / kunci tidak ada / minta jadwal ulang / dll"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Catatan ini untuk kendala di lapangan tanpa perlu close ticket.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status Ticket</label>
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value as DismantleStatusFilter)}
                disabled
                className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="OPEN">OPEN</option>
              </select>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Close ticket dilakukan dari tombol `Close`, agar histori close selalu masuk ke menu terpisah.</p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false)
                  setSelectedRow(null)
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveTicket}
                disabled={saving}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                {saving ? 'Menyimpan...' : 'Simpan Ticket'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Data</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{total}</div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {isClosedView
              ? 'Riwayat ticket dismantle yang sudah ditutup dan dipisahkan dari Isolir aktif.'
              : `Data Isolir aktif dengan ticket dismantle status ${statusLabel.toLowerCase()}.`}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Sudah Ada Ticket</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{filledCount}</div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {isClosedView
              ? 'Jumlah pada halaman saat ini yang sudah memiliki nomor ticket.'
              : 'Jumlah seluruh data sesuai filter yang sudah memiliki nomor ticket.'}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Belum Ada Ticket</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{emptyCount}</div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {isClosedView
              ? 'Histori close tetap aman walau data Isolir aktif dibersihkan atau di-import ulang.'
              : 'Data tanpa ticket tetap dipantau dari menu Isolir dan tidak otomatis masuk ke menu Dismantle.'}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <div
          className={clsx(
            'grid gap-3 lg:items-end',
            canUseAdminScope
              ? 'lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_0.9fr_auto]'
              : 'lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_auto]'
          )}
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Cari</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama pelanggan / alamat / nomor WA"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status Ticket</label>
            <select
              value={effectiveTicketFilter}
              onChange={(e) => setTicketFilter(e.target.value as TicketFilter)}
              disabled={!isClosedView}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="WITH">Sudah Ada Ticket</option>
              {isClosedView && <option value="ALL">Semua</option>}
              {isClosedView && <option value="WITHOUT">Belum Ada Ticket</option>}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Radboox</label>
            <select
              value={radbooxFilter}
              onChange={(e) => setRadbooxFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="ALL">Semua Radboox</option>
              <option value="Radboox 24">Radboox 24</option>
              <option value="Radboox 25">Radboox 25</option>
              <option value="Radboox 26">Radboox 26</option>
            </select>
          </div>
          {canUseAdminScope && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Divisi</label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as DivisionFilter)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="ALL">Semua Divisi</option>
                <option value="CS_ADMIN">CS & Admin CS</option>
                <option value="PENJUALAN">Penjualan</option>
                <option value="NOC_TROUBLESHOOTS">NOC & Troubleshoots</option>
                <option value="CREATOR_DIGITAL">Creator Digital</option>
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status Data</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DismantleStatusFilter)}
              disabled={isDismantleRole}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-800"
            >
              <option value="OPEN">Open</option>
              <option value="CLOSED">Close</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {showSelection && (
              <button
                type="button"
                onClick={deleteSelected}
                disabled={selectedIds.length === 0 || isDeletingSelected}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                title="Hapus data terpilih"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingSelected ? 'Menghapus...' : `Hapus Terpilih (${selectedIds.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={handleImportClick}
              disabled={!canEdit || !supportsWorkflow || isImporting}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? 'Import...' : 'Import Excel'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!supportsWorkflow || isExporting || loading}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Export...' : 'Export Excel'}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {isClosedView
            ? 'Menu close memakai histori dismantle terpisah. Import dan hapus terpilih di mode close hanya mengubah histori close dan tidak mengubah data ticket yang masih open.'
            : 'Menu open membaca data Isolir aktif yang sudah berticket. Data suspend bulanan yang belum punya ticket tetap berada di menu Isolir dengan indikator `Belum`.'}
        </div>

        {!supportsWorkflow && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            Belum ada data operasional dismantle untuk divisi ini. Gunakan perspektif `CS & Admin CS` untuk melihat alur aktifnya.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Memuat data dismantle...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              {supportsWorkflow ? 'Belum ada data dismantle yang sesuai filter.' : 'Belum ada data untuk divisi ini.'}
            </div>
          ) : (
            rows.map((row) => {
              const hasTicket = String(row.ticketDismantle ?? '').trim() !== ''
              const mapsUrl = String(row.ticket?.locationMap ?? '').trim()
              const problemText = String(row.ticket?.description ?? row.radboox ?? '').trim()
              const isClosed = String(row.status ?? '').toUpperCase() === 'CLOSED'
              const rowTone = getRowTone(row)
              const textTone = getCellTextTone(row)

              return (
                <div key={row.id} className={clsx('rounded-lg border border-gray-200 p-3 dark:border-gray-700', rowTone)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => openDetail(row)}
                        className={clsx('block text-left text-sm font-semibold hover:underline break-words', textTone)}
                      >
                        {row.customerName || '-'}
                      </button>
                      <div className={clsx('mt-0.5 text-xs break-words', textTone)}>
                        {row.userEmail || row.marketing || '-'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {showSelection && (
                        <input
                          type="checkbox"
                          checked={selectedSet.has(row.id)}
                          onChange={() => toggleSelected(row.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-0 dark:text-gray-100"
                          aria-label={`Pilih ${row.customerName || `ID ${row.id}`}`}
                        />
                      )}
                      <span className={clsx('inline-flex rounded-md px-2 py-1 text-[11px] font-semibold', getStatusBadgeTone(row.status))}>
                        {row.status || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">Ticket</div>
                      <div className={clsx('font-semibold break-words', textTone)}>
                        {hasTicket ? row.ticketDismantle : 'Belum diisi'}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">No. HP</div>
                      <div className={clsx('font-semibold break-words', textTone)}>{row.customerPhone || '-'}</div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">Alamat</div>
                      <div className={clsx('font-semibold break-words', textTone)}>{row.customerAddress || '-'}</div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">Keterangan</div>
                      <div className={clsx('font-semibold break-words', textTone)}>
                        {row.reason || `Isolir sejak ${formatDate(row.isolationDate)} (${formatSuspendDuration(row.isolationDate)}).`}
                      </div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">Problem</div>
                      <div className={clsx('font-semibold break-words', textTone)}>{problemText || row.radboox || '-'}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                      >
                        View Maps
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => openDetail(row)}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                    >
                      <Info className="h-4 w-4" />
                      Rincian
                    </button>
                    {!isClosed ? (
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        disabled={!canEdit || !supportsWorkflow}
                        className="inline-flex items-center gap-2 rounded-md border border-blue-700 bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        <Pencil className="h-4 w-4" />
                        {hasTicket ? 'Edit Ticket' : 'Isi Ticket'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void reopenHistory(row)}
                        disabled={!canEdit || !supportsWorkflow || actionLoadingId === row.id}
                        className="inline-flex items-center gap-2 rounded-md border border-blue-700 bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {actionLoadingId === row.id ? 'Menyimpan...' : 'Open Kembali'}
                      </button>
                    )}
                    {!isClosed && (
                      <button
                        type="button"
                        onClick={() => openCloseForm(row)}
                        disabled={!canEdit || !supportsWorkflow}
                        className="inline-flex items-center gap-2 rounded-md border border-green-700 bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-600 dark:bg-green-600 dark:hover:bg-green-500"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Close
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto rounded-lg border border-green-700 dark:border-green-700 md:block">
          <table className="min-w-full border-collapse">
            <thead className="bg-green-700 dark:bg-green-800">
              <tr>
                {showSelection && (
                  <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      className="h-4 w-4 rounded border-green-200 text-white focus:ring-0"
                      aria-label="Pilih semua pada halaman ini"
                    />
                  </th>
                )}
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">Nomor Ticket</th>
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">Nama</th>
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">User</th>
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">No. HP</th>
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">Maps</th>
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">Alamat</th>
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">Keterangan</th>
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">Problem</th>
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">Status</th>
                <th className="border border-green-900 px-2 py-2 text-center text-[11px] font-semibold text-white">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showSelection ? 11 : 10} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Memuat data dismantle...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={showSelection ? 11 : 10} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {supportsWorkflow ? 'Belum ada data dismantle yang sesuai filter.' : 'Belum ada data untuk divisi ini.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const hasTicket = String(row.ticketDismantle ?? '').trim() !== ''
                  const mapsUrl = String(row.ticket?.locationMap ?? '').trim()
                  const problemText = String(row.ticket?.description ?? row.radboox ?? '').trim()
                  const isClosed = String(row.status ?? '').toUpperCase() === 'CLOSED'
                  const rowTone = getRowTone(row)
                  const textTone = getCellTextTone(row)
                  return (
                    <tr key={row.id} className={clsx('align-top', rowTone)}>
                      {showSelection && (
                        <td className="border border-green-900 px-2 py-2 text-center text-xs">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(row.id)}
                            onChange={() => toggleSelected(row.id)}
                            className="h-4 w-4 rounded border-green-200 text-white focus:ring-0"
                            aria-label={`Pilih ${row.customerName || `ID ${row.id}`}`}
                          />
                        </td>
                      )}
                      <td className={clsx('border border-green-900 px-2 py-2 text-xs', textTone)}>
                        <span
                          className={clsx(
                            'inline-flex rounded-md px-2 py-1 text-[11px] font-semibold',
                            getTicketBadgeTone(hasTicket)
                          )}
                        >
                          {hasTicket ? row.ticketDismantle : 'Belum diisi'}
                        </span>
                      </td>
                      <td className={clsx('border border-green-900 px-2 py-2 text-xs font-medium', textTone)}>
                        <button
                          type="button"
                          onClick={() => openDetail(row)}
                          className="text-left font-semibold text-blue-700 hover:underline dark:text-blue-200"
                        >
                          {row.customerName || '-'}
                        </button>
                      </td>
                      <td className={clsx('border border-green-900 px-2 py-2 text-xs', textTone)}>{row.userEmail || row.marketing || '-'}</td>
                      <td className={clsx('border border-green-900 px-2 py-2 text-xs font-semibold text-green-900 dark:text-green-100')}>{row.customerPhone || '-'}</td>
                      <td className={clsx('border border-green-900 px-2 py-2 text-xs', textTone)}>
                        {mapsUrl ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                          >
                            Link
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className={clsx('border border-green-900 px-2 py-2 text-xs', textTone)}>{row.customerAddress || '-'}</td>
                      <td className={clsx('border border-green-900 px-2 py-2 text-xs', textTone)}>
                        <div className="max-w-xs whitespace-pre-wrap break-words">
                          {row.reason || `Isolir sejak ${formatDate(row.isolationDate)} (${formatSuspendDuration(row.isolationDate)}).`}
                        </div>
                      </td>
                      <td className={clsx('border border-green-900 px-2 py-2 text-xs', textTone)}>
                        <div className="max-w-xs whitespace-pre-wrap break-words">{problemText || row.radboox || '-'}</div>
                      </td>
                      <td className="border border-green-900 px-2 py-2 text-xs">
                        <span
                          className={clsx(
                            'inline-flex rounded-md px-2 py-1 text-[11px] font-semibold',
                            getStatusBadgeTone(row.status)
                          )}
                        >
                          {row.status || '-'}
                        </span>
                      </td>
                      <td className="border border-green-900 px-2 py-2">
                        <div className="flex flex-col gap-2">
                          {!isClosed ? (
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              disabled={!canEdit || !supportsWorkflow}
                              className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-700 bg-blue-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {hasTicket ? 'Edit Ticket' : 'Isi Ticket'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void reopenHistory(row)}
                              disabled={!canEdit || !supportsWorkflow || actionLoadingId === row.id}
                              className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-700 bg-blue-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {actionLoadingId === row.id ? 'Menyimpan...' : 'Open Kembali'}
                            </button>
                          )}
                          {!isClosed && (
                            <button
                              type="button"
                              onClick={() => openCloseForm(row)}
                              disabled={!canEdit || !supportsWorkflow}
                              className="inline-flex items-center justify-center gap-2 rounded-md border border-green-700 bg-green-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-600 dark:bg-green-600 dark:hover:bg-green-500"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div>
              Halaman {page} / {totalPages} · Total {total}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tampil</span>
              <select
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="75">75</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={!!detailRow}
        title={detailRow ? `Rincian Dismantle: ${detailRow.customerName}` : 'Rincian Dismantle'}
        onClose={() => setDetailRow(null)}
      >
        <div className="space-y-3">
          <textarea
            readOnly
            value={detailRow ? buildDismantleDetailText(detailRow) : ''}
            className="min-h-[220px] w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-black dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          {detailRow?.closePhoto && (
            <a href={detailRow.closePhoto} target="_blank" rel="noreferrer" className="block">
              <Image
                src={detailRow.closePhoto}
                alt="Foto Close"
                width={1200}
                height={800}
                unoptimized
                className="max-h-[320px] w-full rounded-md border border-gray-200 object-contain dark:border-gray-700"
              />
            </a>
          )}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            <button
              type="button"
              onClick={handleShareWa}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Kirim ke WA
            </button>
            <button
              type="button"
              onClick={handleCopyDetail}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <Clipboard className="h-4 w-4" />
              {copied ? 'Tercopy' : 'Copy'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={closeModalOpen}
        title={closeRow ? `Close Ticket: ${closeRow.customerName}` : 'Close Ticket'}
        onClose={() => {
          if (isClosing) return
          setCloseModalOpen(false)
          setCloseRow(null)
          setCloseNote('')
          setClosePhotoFile(null)
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan Close</label>
            <textarea
              rows={3}
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="Contoh: Sudah diambil perangkat / sudah selesai / dll"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Upload Foto</label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setClosePhotoFile(e.target.files?.[0] || null)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Maksimal 3MB (jpg/png).</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCloseModalOpen(false)
                setCloseRow(null)
                setCloseNote('')
                setClosePhotoFile(null)
              }}
              disabled={isClosing}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={submitClose}
              disabled={isClosing || !closeRow}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {isClosing ? 'Menyimpan...' : 'Close Ticket'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        title={selectedRow ? `Ticket Dismantle: ${selectedRow.customerName}` : 'Ticket Dismantle'}
        onClose={() => {
          setModalOpen(false)
          setSelectedRow(null)
        }}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Pelanggan</div>
                <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">{selectedRow?.customerName || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">No WA</div>
                <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">{selectedRow?.customerPhone || '-'}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nomor Ticket Dismantle</label>
              <input
                value={ticketValue}
                onChange={(e) => setTicketValue(e.target.value)}
                placeholder="Contoh: DT/PKN/019/21.02.2026"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Kosongkan field ini jika ticket dismantle belum dibuat atau ingin dihapus.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</label>
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value as DismantleStatusFilter)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSE</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">No. HP</label>
              <input
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                placeholder="628xxxxxxxxxx"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama Pelanggan</label>
              <input
                value={customerNameValue}
                onChange={(e) => setCustomerNameValue(e.target.value)}
                placeholder="Nama pelanggan"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">User (Email)</label>
              <input
                value={userEmailValue}
                onChange={(e) => setUserEmailValue(e.target.value)}
                placeholder="user@perkasa.net.id"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Marketing</label>
              <input
                value={marketingValue}
                onChange={(e) => setMarketingValue(e.target.value)}
                placeholder="Nama marketing"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Maps</label>
              <input
                value={mapsValue}
                onChange={(e) => setMapsValue(e.target.value)}
                placeholder="https://maps.google.com/?q=-6.7,111.0"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              {selectedRow?.ticketId ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Maps disimpan ke data Ticket (ticketId: {selectedRow.ticketId}).</p>
              ) : (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Data ini belum terhubung ke Ticket (ticketId kosong), jadi perubahan Maps tidak bisa disimpan.</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Alamat</label>
              <textarea
                rows={2}
                value={addressValue}
                onChange={(e) => setAddressValue(e.target.value)}
                placeholder="Alamat pelanggan"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan</label>
              <textarea
                rows={2}
                value={reasonValue}
                onChange={(e) => setReasonValue(e.target.value)}
                placeholder="Keterangan / catatan"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan Lapangan</label>
              <textarea
                rows={3}
                value={fieldNoteValue}
                onChange={(e) => setFieldNoteValue(e.target.value)}
                placeholder="Contoh: Perangkat belum bisa diambil karena rumah kosong / kunci tidak ada / minta jadwal ulang / dll"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Catatan ini untuk kendala di lapangan tanpa perlu close ticket.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Problem</label>
              <textarea
                rows={2}
                value={problemValue}
                onChange={(e) => setProblemValue(e.target.value)}
                placeholder="Problem / detail kendala"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              {selectedRow?.ticketId ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Problem disimpan ke Ticket (description) dan juga ke Isolir (radboox).</p>
              ) : (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Problem disimpan ke Isolir (radboox).</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false)
                setSelectedRow(null)
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={saveTicket}
              disabled={saving}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {saving ? 'Menyimpan...' : 'Simpan Ticket'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
