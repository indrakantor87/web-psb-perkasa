'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { Search, Plus, X, Edit3, Trash2, Upload, Download } from 'lucide-react'
import { clsx } from 'clsx'
import { formatSuspendDuration, isDismantleEligible } from '@/lib/isolation-suspend'
import {
  canDeleteIsolationRecords,
  canMutateIsolationRecords,
  canUseAdminIsolationDismantleScope,
} from '@/lib/access'

interface Isolation {
  id: number
  customerName: string
  customerAddress: string | null
  customerPhone: string | null
  userEmail?: string | null
  activeDate?: string | null
  marketing?: string | null
  radboox?: string | null
  sortIndex?: number | null
  price?: number | null
  isolationDate: string
  reason: string | null
  status: string
  restorationDate: string | null
  teknisi: string | null
  ticketDismantle?: string | null
}

interface IsolationViewProps {
  userRole: string
  initialSearch?: string
  initialMarketing?: string
  initialStatus?: string
  initialDivision?: DivisionFilter
}

export type DivisionFilter = 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'

function getDivisionFromUrl(): DivisionFilter | null {
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

export function IsolationView({
  userRole,
  initialSearch = '',
  initialMarketing = '',
  initialStatus = '',
  initialDivision = 'ALL',
}: IsolationViewProps) {
  const [isolations, setIsolations] = useState<Isolation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(initialSearch)
  const [radbooxFilter, setRadbooxFilter] = useState('ALL')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [marketingFilter, setMarketingFilter] = useState(initialMarketing)
  const [statusPreset] = useState(initialStatus) // hidden preset (e.g., OPEN)
  const [division, setDivision] = useState<DivisionFilter>(initialDivision)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [total, setTotal] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isDeletingSelected, setIsDeletingSelected] = useState(false)

  // Sinkronkan selalu marketing dari URL agar tidak hilang saat re-render/dev refresh
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const m = params.get('marketing') || ''
      const s = params.get('status') || ''
      const d = getDivisionFromUrl()
      if (m !== marketingFilter) setMarketingFilter(m)
      if (s && !statusPreset) {
        // statusPreset hanya preset, tidak perlu setState lain
      }
      if (d && d !== division) setDivision(d)
    } catch {}
  }, [division, marketingFilter, statusPreset, userRole])

  // Role Permissions
  const roleUpper = (userRole || '').toUpperCase()
  const canUseAdminScope = canUseAdminIsolationDismantleScope(roleUpper)
  const canEdit = canMutateIsolationRecords(roleUpper)
  const canDelete = canDeleteIsolationRecords(roleUpper)
  const supportsIsolationWorkflow =
    !canUseAdminScope || division === 'ALL' || division === 'CS_ADMIN' || division === 'NOC_TROUBLESHOOTS'
  const canMutate = canEdit && supportsIsolationWorkflow
  const canBulkDelete = canDelete && supportsIsolationWorkflow
  const showActions = canMutate
  const showSelection = canBulkDelete
  const divisionDescriptions: Record<DivisionFilter, string> = {
    ALL: 'Menampilkan seluruh data isolir pada periode aktif tanpa membatasi perspektif divisi tertentu.',
    PENJUALAN: 'Belum ada relasi operasional langsung antara divisi Penjualan dan modul Isolir, jadi tampilan ini masih placeholder.',
    CS_ADMIN: 'Fokus ke pelanggan yang masih berstatus isolir aktif (`OPEN`), cocok untuk follow up CS & Admin CS.',
    NOC_TROUBLESHOOTS: 'Fokus ke data isolir yang sudah normal kembali (`CLOSED`), cocok untuk perspektif tindak lanjut teknis.',
    CREATOR_DIGITAL: 'Belum ada relasi operasional langsung antara Creator Digital dan modul Isolir, jadi tampilan ini masih placeholder.',
  }

  // Form State
  const [formData, setFormData] = useState({
    customerName: '',
    customerAddress: '',
    customerPhone: '',
    userEmail: '',
    activeDate: '',
    marketing: '',
    radboox: '',
    sortIndex: '',
    price: '',
    reason: '',
  })

  const fetchIsolations = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      // Pastikan baca ulang dari URL jika ada
      const urlMarketing = (() => {
        try { return new URLSearchParams(window.location.search).get('marketing') || '' } catch { return '' }
      })()
      const effectiveMarketing = (marketingFilter || urlMarketing).trim()
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (radbooxFilter !== 'ALL') params.append('radboox', radbooxFilter)
      if (effectiveMarketing) params.append('marketing', effectiveMarketing)
      if (statusPreset) params.append('status', statusPreset)
      if (canUseAdminScope && division !== 'ALL') params.append('division', division)
      params.append('page', String(page))
      params.append('limit', String(limit))
      
      const res = await fetch(`/api/isolations?${params.toString()}`, { cache: 'no-store', signal })
      if (res.ok) {
        const data = await res.json()
        const items: Isolation[] = Array.isArray(data) ? data : (data.items || [])
        const totalRemote: number = Array.isArray(data) ? data.length : (data.total || 0)
        setIsolations(items)
        setTotal(totalRemote)
      } else {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        const message = payload.error || 'Gagal mengambil data isolir'
        setError(message)
        setIsolations([])
        setTotal(0)
      }
    } catch (error) {
      if (signal?.aborted) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('Failed to fetch isolations', error)
      setError(error instanceof Error ? error.message : 'Gagal mengambil data isolir')
      setIsolations([])
      setTotal(0)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [canUseAdminScope, debouncedSearch, division, limit, marketingFilter, page, radbooxFilter, statusPreset])

  // Debounce pencarian untuk mengurangi request beruntun
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ register?: (p: Promise<unknown> | void) => void }>
      ce.detail?.register?.(fetchIsolations())
    }
    window.addEventListener('app:refresh', handler)
    return () => window.removeEventListener('app:refresh', handler)
  }, [fetchIsolations])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, division, limit, marketingFilter, radbooxFilter])

  useEffect(() => {
    const controller = new AbortController()
    void fetchIsolations(controller.signal)
    return () => controller.abort()
  }, [fetchIsolations])

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev
      const current = new Set(isolations.map((x) => x.id))
      return prev.filter((id) => current.has(id))
    })
  }, [isolations])

  useEffect(() => {
    setSelectedIds([])
  }, [page, limit, debouncedSearch, radbooxFilter, marketingFilter, statusPreset, division])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canMutate) return
    setIsSubmitting(true)
    try {
      const url = editId ? `/api/isolations/${editId}` : '/api/isolations'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      if (res.ok) {
        setIsModalOpen(false)
        setEditId(null)
        setFormData({ customerName: '', customerAddress: '', customerPhone: '', userEmail: '', activeDate: '', marketing: '', radboox: '', sortIndex: '', price: '', reason: '' })
        fetchIsolations()
      } else {
        alert('Gagal menyimpan data isolir')
      }
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEdit = (item: Isolation) => {
    setEditId(item.id)
    setFormData({
      customerName: item.customerName || '',
      customerAddress: item.customerAddress || '',
      customerPhone: item.customerPhone || '',
      userEmail: item.userEmail || '',
      activeDate: item.activeDate ? new Date(item.activeDate).toISOString().split('T')[0] : '',
      marketing: item.marketing || '',
      radboox: item.radboox || '',
      sortIndex: typeof item.sortIndex === 'number' ? String(item.sortIndex) : '',
      price: item.price ? String(item.price) : '',
      reason: item.reason || '',
    })
    setIsModalOpen(true)
  }

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAllOnPage = () => {
    const pageIds = isolations.map((x) => x.id)
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
    if (!canBulkDelete) return
    if (selectedIds.length === 0) return
    if (!confirm(`Hapus ${selectedIds.length} data yang dipilih?`)) return
    setIsDeletingSelected(true)
    try {
      const idsSet = new Set(selectedIds)
      const removedOnPage = isolations.filter((x) => idsSet.has(x.id)).length
      const willMovePrevPage = removedOnPage === isolations.length && page > 1
      setIsolations((prev) => prev.filter((x) => !idsSet.has(x.id)))
      setTotal((prev) => Math.max(0, prev - removedOnPage))
      setSelectedIds([])

      const ids = [...selectedIds]
      const res = await fetch('/api/isolations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, preserveDismantleHistory: true }),
      })
      const data = (await res.json().catch(() => ({}))) as { count?: number; error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghapus data')
      }
      alert(`Berhasil menghapus ${data.count ?? ids.length} data`)
      if (willMovePrevPage) {
        setPage((p) => Math.max(1, p - 1))
        return
      }
      await fetchIsolations()
    } catch (e) {
      console.error(e)
      fetchIsolations()
      alert('Terjadi kesalahan saat menghapus data terpilih')
    } finally {
      setIsDeletingSelected(false)
    }
  }

  const handleImportClick = () => {
    if (!canMutate) return
    if (!fileInputRef.current) return
    fileInputRef.current.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canMutate) return
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      setLoading(true)
      const res = await fetch('/api/isolations/import', {
        method: 'POST',
        body: formData,
      })
      const data = (await res.json()) as { message?: string; error?: string; errors?: string[] }
      if (res.ok) {
        const detail = Array.isArray(data.errors) && data.errors.length > 0 ? `\n\n${data.errors.join('\n')}` : ''
        alert(`${data.message || 'Import berhasil'}${detail}`)
        fetchIsolations()
      } else {
        const detail = Array.isArray(data.errors) && data.errors.length > 0 ? `\n\n${data.errors.join('\n')}` : ''
        alert(`${data.error || 'Import gagal'}${detail}`)
      }
    } catch (error) {
      console.error('Import isolir gagal', error)
      alert('Terjadi kesalahan saat import')
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleExportExcel = async () => {
    try {
      setIsExporting(true)
      const XLSX = await import('xlsx')

      const params = new URLSearchParams()
      const urlMarketing = (() => {
        try { return new URLSearchParams(window.location.search).get('marketing') || '' } catch { return '' }
      })()
      const effectiveMarketing = marketingFilter || urlMarketing
      if (search) params.append('search', search)
      if (radbooxFilter !== 'ALL') params.append('radboox', radbooxFilter)
      if (effectiveMarketing) params.append('marketing', effectiveMarketing)
      if (statusPreset) params.append('status', statusPreset)
      if (canUseAdminScope && division !== 'ALL') params.append('division', division)
      params.append('export', 'all')
      params.append('limit', '50000')

      const res = await fetch(`/api/isolations?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal mengambil data')
      const data = await res.json()
      const items: Isolation[] = Array.isArray(data) ? data : (data.items || [])
      const rows = items.map((it, idx) => ({
        'No': idx + 1,
        'Nama Pelanggan': it.customerName,
        'Active Date': it.activeDate ? format(new Date(it.activeDate), 'dd/MM/yyyy') : '-',
        'User': it.userEmail || '-',
        'No. HP': it.customerPhone || '-',
        'Keterangan': it.reason || '-',
        'Marketing': it.marketing || '-',
        'Radboox': it.radboox || '-',
        'Urutan': typeof it.sortIndex === 'number' ? it.sortIndex : '-',
        'Suspend': formatSuspendDuration(it.isolationDate),
        'Harga': it.price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(it.price) : '-',
        'Ticket': it.ticketDismantle ? String(it.ticketDismantle) : '-',
        'Status Dismantle': isDismantleEligible(it.isolationDate) ? 'Masuk Dismantle' : 'Belum',
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Isolir')
      const fileSuffix = radbooxFilter !== 'ALL'
        ? `_${radbooxFilter.replace(/[^a-z0-9]+/gi, '_')}`
        : ''
      XLSX.writeFile(wb, `Isolir_Export${fileSuffix}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`)
    } catch (e) {
      alert('Gagal export')
      console.error(e)
    } finally {
      setIsExporting(false)
    }
  }

  const suspendLabel = (isoDate?: string | null) => {
    return formatSuspendDuration(isoDate)
  }

  const selectedSet = new Set(selectedIds)
  const allOnPageSelected = isolations.length > 0 && isolations.every((x) => selectedSet.has(x.id))
  const someOnPageSelected = isolations.some((x) => selectedSet.has(x.id))
  const desktopColumns = 11 + (showSelection ? 1 : 0) + (showActions ? 1 : 0)

  return (
    <div className="space-y-4 sm:space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari Nama / User / No HP / Marketing..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <select
            value={radbooxFilter}
            onChange={(e) => setRadbooxFilter(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:w-56"
          >
            <option value="ALL">Semua Radboox</option>
            <option value="Radboox 24">Radboox 24</option>
            <option value="Radboox 25">Radboox 25</option>
            <option value="Radboox 26">Radboox 26</option>
          </select>
          {canUseAdminScope && (
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value as DivisionFilter)}
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:w-56"
            >
              <option value="ALL">Semua Divisi</option>
              <option value="PENJUALAN">Penjualan</option>
              <option value="CS_ADMIN">CS & Admin CS</option>
              <option value="NOC_TROUBLESHOOTS">NOC & Troubleshoots</option>
              <option value="CREATOR_DIGITAL">Creator Digital</option>
            </select>
          )}
        </div>
        {canEdit && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || !supportsIsolationWorkflow}
              className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 sm:w-auto"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Export...' : 'Export Excel'}
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              disabled={!canMutate}
              className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 sm:w-auto"
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={deleteSelected}
                disabled={selectedIds.length === 0 || isDeletingSelected || !canBulkDelete}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 sm:w-auto"
                title="Hapus Data Terpilih"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingSelected ? 'Menghapus...' : `Hapus Terpilih (${selectedIds.length})`}
              </button>
            )}
            <button
              onClick={() => {
                if (!canMutate) return
                setEditId(null)
                setFormData({
                  customerName: '',
                  customerAddress: '',
                  customerPhone: '',
                  userEmail: '',
                  activeDate: '',
                  marketing: '',
                  radboox: '',
                  sortIndex: '',
                  price: '',
                  reason: '',
                })
                setIsModalOpen(true)
              }}
              disabled={!canMutate}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Tambah Isolir
            </button>
          </div>
        )}
      </div>

      {canUseAdminScope && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {divisionDescriptions[division]}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mp-desktop-table mp-table-enhanced overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="hidden bg-gray-50 md:table-header-group dark:bg-gray-900">
              <tr>
                {showSelection && (
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => {
                        if (!el) return
                        el.indeterminate = someOnPageSelected && !allOnPageSelected
                      }}
                      onChange={toggleSelectAllOnPage}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label="Pilih semua"
                    />
                  </th>
                )}
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">No</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">Nama Pelanggan</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">Active Date</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">User</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">No. HP</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">Marketing</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">Radboox</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">Urutan</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">Suspend</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">Harga</th>
                <th className="w-[240px] px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">Keterangan</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:px-3">Ticket</th>
                {showActions && (
                  <th className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-100 uppercase tracking-wider">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={desktopColumns} className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Memuat...</td>
                </tr>
              ) : isolations.length === 0 ? (
                <tr>
                  <td colSpan={desktopColumns} className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {supportsIsolationWorkflow ? 'Tidak ada data ditemukan' : 'Belum ada data untuk divisi ini di modul Isolir'}
                  </td>
                </tr>
              ) : (
                isolations.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    {showSelection && (
                  <td className="hidden whitespace-nowrap px-2 py-3 text-sm text-gray-500 dark:text-gray-400 md:table-cell sm:px-3">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-0 dark:text-gray-100"
                          aria-label={`Pilih ${item.customerName}`}
                        />
                      </td>
                    )}
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-900 dark:text-white">
                      {item.customerName}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {item.activeDate ? format(new Date(item.activeDate), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {item.userEmail || '-'}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {item.customerPhone ? (
                        <a
                          href={`https://wa.me/${item.customerPhone.replace(/^0/, '62').replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {item.customerPhone}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {item.marketing || '-'}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {item.radboox || '-'}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {typeof item.sortIndex === 'number' ? item.sortIndex : '-'}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {suspendLabel(item.isolationDate)}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {item.price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.price) : '-'}
                    </td>
                    <td
                      className={clsx(
                        'hidden md:table-cell px-2 sm:px-3 py-3 text-sm w-[240px] max-w-[240px] whitespace-normal break-words mp-clamp-3 leading-snug',
                        String(item.reason ?? '').trim().toLowerCase() === 'tidak dilanjutkan'
                          ? 'text-red-700 dark:text-red-300 font-semibold'
                          : 'text-gray-500 dark:text-gray-400'
                      )}
                      title={item.reason || ''}
                    >
                      {item.reason || '-'}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {item.ticketDismantle ? (
                        String(item.ticketDismantle)
                      ) : isDismantleEligible(item.isolationDate) ? (
                        <span className="inline-flex rounded-full bg-orange-500 px-2 py-1 text-[10px] font-semibold text-white">
                          Auto Dismantle
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    {showActions && (
                      <td className="hidden md:table-cell px-2 sm:px-3 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(item)}
                          className="text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                              title="Edit"
                            >
                              <Edit3 className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Mobile View (Card Style) */}
                    <td className="table-cell md:hidden px-4 py-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-start gap-3">
                            {showSelection && (
                              <input
                                type="checkbox"
                                checked={selectedSet.has(item.id)}
                                onChange={() => toggleSelected(item.id)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-0 dark:text-gray-100"
                                aria-label={`Pilih ${item.customerName}`}
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{item.customerName}</div>
                              {item.userEmail && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.userEmail}</div>
                              )}
                            </div>
                          </div>
                          <span className={clsx(
                            "px-2 py-0.5 text-[10px] font-semibold rounded-full",
                            item.status === 'OPEN' 
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          )}>
                            {item.status === 'OPEN' ? 'TERISOLIR' : 'NORMAL'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <div>
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Kontak:</span>
                            {item.customerPhone ? (
                              <a 
                                href={`https://wa.me/${item.customerPhone.replace(/^0/, '62').replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {item.customerPhone}
                              </a>
                            ) : '-'}
                          </div>
                          <div>
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Active Date:</span>
                            {item.activeDate ? format(new Date(item.activeDate), 'dd/MM/yyyy') : '-'}
                          </div>
                          <div>
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Suspend:</span>
                            {suspendLabel(item.isolationDate)}
                          </div>
                          <div>
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Harga:</span>
                            {item.price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.price) : '-'}
                          </div>
                          <div>
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Ticket:</span>
                            {item.ticketDismantle ? String(item.ticketDismantle) : isDismantleEligible(item.isolationDate) ? 'Auto Dismantle' : '-'}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Alasan:</span>
                            <span
                              className={clsx(
                                String(item.reason ?? '').trim().toLowerCase() === 'tidak dilanjutkan'
                                  ? 'text-red-700 dark:text-red-300 font-semibold'
                                  : undefined
                              )}
                            >
                              {item.reason || '-'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Marketing:</span>
                            {item.marketing || '-'}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Radboox:</span>
                            {item.radboox || '-'}
                          </div>
                          <div>
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Urutan:</span>
                            {typeof item.sortIndex === 'number' ? item.sortIndex : '-'}
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(item)}
                              className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-4">
          {total > 0 ? (
            <span>
              Menampilkan {Math.min((page - 1) * limit + 1, total)}–
              {Math.min(page * limit, total)} dari {total} data
            </span>
          ) : (
            <span>Tidak ada data</span>
          )}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs">Tampil</span>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {[25, 50, 75, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            Sebelumnya
          </button>
          <span>Halaman {page}</span>
          <button
            onClick={() => setPage((p) => (p * limit < total ? p + 1 : p))}
            disabled={page * limit >= total}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            Berikutnya
          </button>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editId ? 'Edit Data Isolir' : 'Tambah Data Isolir'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Perbarui data isolir dengan format yang rapi dan singkat.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama Pelanggan</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">User</label>
                  <input
                    type="text"
                    value={formData.userEmail}
                    onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="ID / Email pelanggan"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">No. Handphone / WA</label>
                  <input
                    type="text"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Active Date</label>
                  <input
                    type="date"
                    value={formData.activeDate}
                    onChange={(e) => setFormData({ ...formData, activeDate: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Marketing</label>
                  <input
                    type="text"
                    value={formData.marketing}
                    onChange={(e) => setFormData({ ...formData, marketing: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Nama marketing"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Radboox</label>
                <select
                  value={formData.radboox}
                  onChange={(e) => setFormData({ ...formData, radboox: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">- Pilih Radboox -</option>
                  <option value="Radboox 24">Radboox 24</option>
                  <option value="Radboox 25">Radboox 25</option>
                  <option value="Radboox 26">Radboox 26</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Urutan</label>
                <input
                  type="number"
                  value={formData.sortIndex}
                  onChange={(e) => setFormData({ ...formData, sortIndex: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="10, 20, 30 ..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Harga</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="150000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Link Maps</label>
                <input
                  type="text"
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="https://maps.google.com/?q=-6.7,111.0"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan</label>
                <textarea
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="Tulis keterangan isolir..."
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
