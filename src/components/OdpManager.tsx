'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { Map, Maximize2, Minimize2, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import dynamic from 'next/dynamic'

// Komponen peta diload secara dinamis hanya di sisi klien untuk menghindari error 'window is not defined'
const OdpRealtimeMap = dynamic(() => import('./OdpRealtimeMap'), {
  ssr: false,
  loading: () => <div className="flex h-[420px] w-full animate-pulse items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">Memuat Peta...</div>,
})

export type OdpRow = {
  id: number
  nama_odp: string
  wilayah: string
  lokasi: string
  kapasitas: number
  terpakai: number
  status_tiang: string
  latitude?: number | null
  longitude?: number | null
}

type DivisionFilter = 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'

function toInt(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : NaN
}

function parseLatLng(input: string) {
  const s = String(input ?? '').trim()
  if (!s) return null
  const direct = s.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  const at = s.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const q = s.match(/[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const ll = s.match(/[?&]ll=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const query = s.match(/[?&]query=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const data3d4d = s.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
  const m = direct ?? at ?? q ?? ll ?? query ?? data3d4d
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null

  const aIsLat = a >= -90 && a <= 90
  const bIsLat = b >= -90 && b <= 90
  const aIsLng = a >= -180 && a <= 180
  const bIsLng = b >= -180 && b <= 180

  if (aIsLat && bIsLng) return { latitude: a, longitude: b }
  if (aIsLng && bIsLat) return { latitude: b, longitude: a }
  return null
}

function OdpBadge({ kapasitas, terpakai }: { kapasitas: number; terpakai: number }) {
  const cap = Math.max(1, Number(kapasitas) || 8)
  const used = Math.max(0, Number(terpakai) || 0)
  const ratio = used / cap

  const className =
    used >= cap
      ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-800'
      : ratio > 0.5
        ? 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800'
        : 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800'

  const label = used >= cap ? 'Penuh' : ratio > 0.5 ? '> 50%' : '< 50%'

  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1', className)}>{label}</span>
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-4">
      <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
            Tutup
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function OdpManager({
  canEdit,
  userRole,
  initialDivision = 'ALL',
}: {
  canEdit: boolean
  userRole?: string
  initialDivision?: DivisionFilter
}) {
  const defaultWilayah = useMemo(() => ['Pati', 'Bumiayu', 'Banjarsari', 'Kedungbulus', 'Trangkil', 'Margoyoso'], [])
  const roleUpper = (userRole || '').toUpperCase()
  const isAdmin = roleUpper === 'ADMIN'
  const [division, setDivision] = useState<DivisionFilter>(initialDivision)
  const [q, setQ] = useState('')
  const [qQuery, setQQuery] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [geoResolving, setGeoResolving] = useState(false)
  const [wilayah, setWilayah] = useState('')
  const [wilayahList, setWilayahList] = useState<string[]>(defaultWilayah)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [rows, setRows] = useState<OdpRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputId = 'odp-import-input'

  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const [mapOpen, setMapOpen] = useState(false)
  const [mapRows, setMapRows] = useState<OdpRow[]>([])
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapKey, setMapKey] = useState(0)
  const [focusedOdpId, setFocusedOdpId] = useState<number | null>(null)
  const [searchPoint, setSearchPoint] = useState<{ latitude: number; longitude: number } | null>(null)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const supportsOdpWorkflow = !isAdmin || division === 'ALL' || division === 'CS_ADMIN'
  const canMutate = canEdit && supportsOdpWorkflow
  const divisionDescriptions: Record<DivisionFilter, string> = {
    ALL: 'Menampilkan seluruh aset ODP aktif tanpa membatasi perspektif divisi tertentu.',
    PENJUALAN: 'Belum ada relasi operasional langsung antara divisi Penjualan dan modul PORT ODP, jadi tampilan ini masih placeholder.',
    CS_ADMIN: 'Fokus ke data PORT ODP untuk kebutuhan operasional CS & Admin CS sesuai struktur menu terbaru.',
    NOC_TROUBLESHOOTS: 'Modul PORT ODP saat ini tidak ditampilkan sebagai alur utama NOC & Troubleshoots, jadi tampilan ini tetap placeholder.',
    CREATOR_DIGITAL: 'Belum ada relasi operasional langsung antara Creator Digital dan modul PORT ODP, jadi tampilan ini masih placeholder.',
  }

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<OdpRow | null>(null)
  const [form, setForm] = useState({ nama_odp: '', wilayah: 'Pati', lokasi: '', koordinat: '', kapasitas: '8', terpakai: '0', status_tiang: 'Perkasa' })

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(qQuery), 350)
    return () => clearTimeout(t)
  }, [qQuery])

  const fetchRows = useCallback(async (signal?: AbortSignal, bypassCache?: boolean) => {
    const url = new URL('/api/odp', window.location.origin)
    url.searchParams.set('q', qDebounced)
    url.searchParams.set('wilayah', wilayah)
    url.searchParams.set('page', String(page))
    url.searchParams.set('pageSize', String(pageSize))
    if (isAdmin && division !== 'ALL') url.searchParams.set('division', division)
    if (bypassCache) url.searchParams.set('bypassCache', '1')
    const r = await fetch(url.toString(), { cache: 'no-store', signal })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data?.error ?? 'Gagal memuat data')
    setRows((data.rows ?? []) as OdpRow[])
    setTotal(data.total ?? 0)
    const fromServer = Array.isArray(data?.wilayahList) ? (data.wilayahList as string[]) : []
    const merged = Array.from(new Set([...defaultWilayah, ...fromServer].map((x) => String(x).trim()).filter(Boolean)))
    setWilayahList(merged)
  }, [defaultWilayah, division, isAdmin, page, pageSize, qDebounced, wilayah])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchRows(controller.signal)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [fetchRows])

  // Pull to refresh support
  useEffect(() => {
    const handler = (ev: Event) => {
      const customEv = ev as CustomEvent
      if (customEv.detail && typeof customEv.detail.register === 'function') {
        customEv.detail.register(fetchRows(undefined, true))
      } else {
        fetchRows(undefined, true)
      }
    }
    window.addEventListener('app:refresh', handler)
    return () => window.removeEventListener('app:refresh', handler)
  }, [fetchRows])

  useEffect(() => {
    setPage(1)
  }, [division, q, pageSize, wilayah])

  useEffect(() => {
    setSelectedIds([])
  }, [division, q, wilayah])

  const fetchMap = useCallback(async (signal?: AbortSignal) => {
    const url = new URL('/api/odp', window.location.origin)
    url.searchParams.set('q', qDebounced)
    url.searchParams.set('wilayah', wilayah)
    url.searchParams.set('map', '1')
    if (isAdmin && division !== 'ALL') url.searchParams.set('division', division)
    url.searchParams.set('bypassCache', '1')
    const r = await fetch(url.toString(), { cache: 'no-store', signal })
    const data = await r.json().catch(() => [])
    if (!r.ok) throw new Error(data?.error ?? 'Gagal memuat peta')
    setMapRows(Array.isArray(data) ? (data as OdpRow[]) : [])
  }, [division, isAdmin, qDebounced, wilayah])

  useEffect(() => {
    if (!mapOpen) return
    const controller = new AbortController()
    setMapLoading(true)
    setMapError(null)
    fetchMap(controller.signal)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setMapError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setMapLoading(false)
      })
    return () => controller.abort()
  }, [fetchMap, mapKey, mapOpen])

  useEffect(() => {
    if (!mapFullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMapFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mapFullscreen])

  const openAdd = () => {
    if (!canMutate) return
    setEditing(null)
    setForm({ nama_odp: '', wilayah: wilayah || 'Pati', lokasi: '', koordinat: '', kapasitas: '8', terpakai: '0', status_tiang: 'Perkasa' })
    setModalOpen(true)
  }

  const openEdit = (row: OdpRow) => {
    if (!canMutate) return
    setEditing(row)
    const koordinat =
      Number.isFinite(row.latitude) && Number.isFinite(row.longitude) ? `${Number(row.latitude)},${Number(row.longitude)}` : ''
    setForm({
      nama_odp: row.nama_odp,
      wilayah: row.wilayah || 'Pati',
      lokasi: row.lokasi,
      koordinat,
      kapasitas: String(row.kapasitas ?? 8),
      terpakai: String(row.terpakai ?? 0),
      status_tiang: row.status_tiang ?? 'Perkasa',
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!canMutate) return
    setSaving(true)
    setError(null)
    try {
      const kapasitas = toInt(form.kapasitas)
      const terpakai = toInt(form.terpakai)
      if (!form.nama_odp.trim()) throw new Error('Nama ODP wajib diisi')
      if (!form.wilayah.trim()) throw new Error('Wilayah wajib diisi')
      if (!form.lokasi.trim()) throw new Error('Lokasi wajib diisi')
      if (!Number.isFinite(kapasitas) || kapasitas < 1) throw new Error('Kapasitas tidak valid')
      if (kapasitas > 128) throw new Error('Kapasitas maksimal 128')
      if (!Number.isFinite(terpakai) || terpakai < 0) throw new Error('Terpakai tidak valid')
      if (terpakai > kapasitas) throw new Error('Terpakai melebihi kapasitas')

      const coords = parseLatLng(form.koordinat.trim()) ?? parseLatLng(form.lokasi.trim())
      if (form.koordinat.trim() && !coords) throw new Error('Koordinat tidak valid. Gunakan format lat,lng atau link maps')

      const payload = {
        nama_odp: form.nama_odp.trim(),
        wilayah: form.wilayah.trim(),
        lokasi: form.lokasi.trim(),
        kapasitas,
        terpakai,
        status_tiang: form.status_tiang.trim() || 'Perkasa',
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      }

      const target = editing ? `/api/odp/${editing.id}` : '/api/odp'
      const method = editing ? 'PUT' : 'POST'

      const r = await fetch(target, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error ?? 'Gagal menyimpan')

      setModalOpen(false)
      await fetchRows()
      if (mapOpen) setMapKey((k) => k + 1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const removeRow = async (row: OdpRow) => {
    if (!canMutate) return
    if (!confirm(`Hapus ODP \"${row.nama_odp}\"?`)) return
    const r = await fetch(`/api/odp/${row.id}`, { method: 'DELETE' })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      setError(data?.error ?? 'Gagal menghapus')
      return
    }
    setMapRows((prev) => prev.filter((x) => x.id !== row.id))
    setFocusedOdpId((prev) => (prev === row.id ? null : prev))
    setRows((prev) => prev.filter((x) => x.id !== row.id))
    setTotal((prev) => Math.max(0, prev - 1))
    setSelectedIds((prev) => prev.filter((id) => id !== row.id))
    await fetchRows(undefined, true)
    if (mapOpen) setMapKey((k) => k + 1)
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
    if (!canMutate) return
    if (selectedIds.length === 0) return
    if (!confirm(`Hapus ${selectedIds.length} ODP yang dipilih?`)) return
    setBulkDeleting(true)
    setError(null)
    try {
      const r = await fetch('/api/odp/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((data as { error?: string })?.error ?? 'Gagal menghapus data')
      const idsSet = new Set(selectedIds)
      setMapRows((prev) => prev.filter((x) => !idsSet.has(x.id)))
      setFocusedOdpId((prev) => (prev !== null && idsSet.has(prev) ? null : prev))
      const removedOnPage = rows.filter((x) => idsSet.has(x.id)).length
      setRows((prev) => prev.filter((x) => !idsSet.has(x.id)))
      setTotal((prev) => Math.max(0, prev - removedOnPage))
      setSelectedIds([])
      await fetchRows(undefined, true)
      if (mapOpen) setMapKey((k) => k + 1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    setError(null)
    try {
      const XLSX = await import('xlsx')
      const params = new URLSearchParams()
      params.set('all', '1')
      params.set('q', q)
      params.set('wilayah', wilayah)
      if (isAdmin && division !== 'ALL') params.set('division', division)
      const res = await fetch(`/api/odp?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? 'Gagal export')

      const allRows = (Array.isArray(data) ? data : []) as OdpRow[]
      const payload = allRows.map((row, idx) => {
        const kapasitas = Number(row.kapasitas ?? 8) || 8
        const terpakai = Number(row.terpakai ?? 0) || 0
        const sisa = Math.max(0, kapasitas - terpakai)
        const ratio = kapasitas > 0 ? terpakai / kapasitas : 0
        const status = terpakai >= kapasitas ? 'Penuh' : ratio > 0.5 ? '> 50%' : '< 50%'
        return {
          No: idx + 1,
          'Nama ODP': row.nama_odp,
          POP: row.wilayah,
          Lokasi: row.lokasi,
          Kapasitas: kapasitas,
          Terpakai: terpakai,
          Sisa: sisa,
          Status: status,
          'Status Tiang': row.status_tiang || 'n/a',
        }
      })

      const workbook = XLSX.utils.book_new()
      const worksheet =
        payload.length > 0
          ? XLSX.utils.json_to_sheet(payload)
          : XLSX.utils.aoa_to_sheet([['No', 'Nama ODP', 'POP', 'Lokasi', 'Kapasitas', 'Terpakai', 'Sisa', 'Status', 'Status Tiang']])

      worksheet['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 14 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(workbook, worksheet, 'PORT ODP')
      XLSX.writeFile(workbook, `PORT_ODP_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      alert('Gagal export Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    if (!canMutate) return
    const el = document.getElementById(fileInputId) as HTMLInputElement | null
    el?.click()
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canMutate) return
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    setImportError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/odp/import', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? 'Gagal import')
      alert((data as { message?: string })?.message ?? 'Import selesai')
      await fetchRows(undefined, true)
      if (mapOpen) setMapKey((k) => k + 1)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setImportError(msg)
      alert('Gagal import: ' + msg)
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  const handleLocationClick = (odp: OdpRow) => {
    if (Number.isFinite(odp.latitude) && Number.isFinite(odp.longitude)) {
      setMapOpen(true)
      setFocusedOdpId(odp.id)
      
      // Gunakan setTimeout untuk memastikan elemen peta sudah dirender
      setTimeout(() => {
        const mapEl = document.getElementById('odp-map-container')
        if (mapEl) {
          // Gunakan scrollIntoView yang lebih modern dan handal
          mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }, 400)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">PORT ODP</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Kapasitas ODP bisa berbeda. Merah (penuh), Kuning (&gt; 50%), Hijau (&lt; 50%).</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button
            onClick={() => setMapOpen((v) => !v)}
            disabled={!supportsOdpWorkflow}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:w-auto"
            title="Tampilan peta realtime"
          >
            <Map className="h-4 w-4" />
            {mapOpen ? 'Tutup Peta' : 'Lihat Peta'}
          </button>
          {canEdit && (
            <button onClick={openAdd} disabled={!canMutate} className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:w-auto">
              <Plus className="h-4 w-4" />
              Tambah ODP
            </button>
          )}
          {canEdit && selectedIds.length > 0 && (
            <button
              onClick={deleteSelected}
              disabled={bulkDeleting || !canMutate}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 sm:w-auto"
              title="Hapus ODP yang dipilih"
            >
              <Trash2 className="h-4 w-4" />
              {bulkDeleting ? 'Menghapus...' : `Hapus Dipilih (${selectedIds.length})`}
            </button>
          )}
          <button
            onClick={handleExportExcel}
            disabled={isExporting || !supportsOdpWorkflow}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 sm:w-auto"
          >
            {isExporting ? 'Export...' : 'Export Excel'}
          </button>
          {canEdit && (
            <>
              <input id={fileInputId} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFileChange} />
              <button
                onClick={handleImportClick}
                disabled={isImporting || !canMutate}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 sm:w-auto"
                title="Import Excel (Admin/CS/NOC/TEKNISI)"
              >
                <Upload className="h-4 w-4" />
                {isImporting ? 'Mengimpor...' : 'Import Excel'}
              </button>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {divisionDescriptions[division]}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-white sm:w-auto" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                    Tampil {n}
                </option>
              ))}
            </select>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-white sm:w-auto"
                value={wilayah}
                onChange={(e) => setWilayah(e.target.value)}
              >
                <option value="">Semua POP</option>
                {wilayahList.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              {isAdmin && (
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-white sm:w-auto"
                  value={division}
                  onChange={(e) => setDivision(e.target.value as DivisionFilter)}
                >
                  <option value="ALL">Semua Divisi</option>
                  <option value="PENJUALAN">Penjualan</option>
                  <option value="CS_ADMIN">CS & Admin CS</option>
                  <option value="NOC_TROUBLESHOOTS">NOC & Troubleshoots</option>
                  <option value="CREATOR_DIGITAL">Creator Digital</option>
                </select>
              )}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => {
                const v = e.target.value
                setQ(v)
                const parsed = parseLatLng(v)
                if (parsed) {
                  setSearchPoint(parsed)
                  setQQuery('')
                  setMapError(null)
                  setMapOpen(true)
                  setMapKey((k) => k + 1)
                  setGeoResolving(false)
                } else {
                  const isMapsLink = /maps\.app\.goo\.gl|google\.com\/maps|maps\.google\.com/i.test(v)
                  if (isMapsLink) {
                    setGeoResolving(true)
                    setMapError(null)
                    setSearchPoint(null)
                    setQQuery('')
                    setMapOpen(true)
                    setMapKey((k) => k + 1)
                    fetch('/api/maps/resolve', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ url: v }),
                    })
                      .then(async (r) => {
                        const data = await r.json().catch(() => ({}))
                        if (!r.ok) throw new Error((data as { error?: string })?.error ?? 'Gagal membaca link maps')
                        const lat = Number((data as { latitude?: unknown }).latitude)
                        const lng = Number((data as { longitude?: unknown }).longitude)
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Koordinat tidak valid')
                        setSearchPoint({ latitude: lat, longitude: lng })
                      })
                      .catch((err: unknown) => {
                        setMapError(err instanceof Error ? err.message : String(err))
                      })
                      .finally(() => {
                        setGeoResolving(false)
                      })
                  } else {
                    setGeoResolving(false)
                    setSearchPoint(null)
                    setQQuery(v)
                  }
                }
              }}
              placeholder="Cari ODP / lokasi... (paste link Google Maps)"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-white md:w-80"
            />
          </div>
        </div>

        {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}
        {importError && <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{importError}</div>}

        {mapOpen && (
          <div
            id="odp-map-container"
            className={clsx(
              'space-y-3',
              mapFullscreen
                ? 'fixed inset-0 z-[60] bg-gray-950/85 p-3 backdrop-blur-sm'
                : 'mt-4'
            )}
          >
            <div className={clsx(mapFullscreen && 'flex h-full flex-col overflow-hidden rounded-xl bg-white p-3 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700')}>
              <div className="mb-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Marker: {mapRows.length}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMapFullscreen((v) => !v)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                    title={mapFullscreen ? 'Keluar Fullscreen' : 'Fullscreen'}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-2">
                      {mapFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      {mapFullscreen ? 'Normal' : 'Fullscreen'}
                    </span>
                  </button>
                  <button
                    onClick={() => setMapKey((k) => k + 1)}
                    disabled={mapLoading}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                    type="button"
                  >
                    {mapLoading ? 'Memuat...' : 'Refresh Peta'}
                  </button>
                </div>
              </div>
              {geoResolving && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  Membaca link Google Maps...
                </div>
              )}
              {mapError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{mapError}</div>}
              {mapLoading ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">Memuat peta...</div>
              ) : (
                <OdpRealtimeMap
                  key={`${mapFullscreen ? 'fs' : 'normal'}:${searchPoint ? `${searchPoint.latitude}:${searchPoint.longitude}` : 'no-target'}`}
                  rows={mapRows}
                  focusId={focusedOdpId}
                  searchPoint={searchPoint}
                  heightClass={mapFullscreen ? 'h-[calc(100vh-140px)]' : 'h-[420px]'}
                  invalidateKey={`${mapFullscreen}:${mapKey}:${searchPoint ? `${searchPoint.latitude}:${searchPoint.longitude}` : 'no-target'}`}
                />
              )}
            </div>
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="mp-table-enhanced overflow-x-auto">
          <table className="w-full min-w-[980px] lg:min-w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-300">
                {canEdit && (
                  <th className="py-3 pr-4 pl-3 w-10">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && rows.every((r) => selectedSet.has(r.id))}
                      onChange={toggleSelectAllCurrent}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-0 dark:text-gray-100"
                    />
                  </th>
                )}
                <th className="py-3 pr-4 pl-3">#</th>
                <th className="py-3 pr-4">Nama ODP</th>
                <th className="py-3 pr-4">POP</th>
                <th className="py-3 pr-4">Lokasi</th>
                <th className="py-3 pr-4">Kapasitas</th>
                <th className="py-3 pr-4">Terpakai</th>
                <th className="py-3 pr-4">Sisa</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Status Tiang</th>
                {canEdit && <th className="py-3">Aksi</th>}
              </tr>
            </thead>
            <tbody className="text-sm text-gray-800 dark:text-gray-200">
              {loading ? (
                <tr>
                  <td className="py-6 text-center text-gray-500 dark:text-gray-400" colSpan={canEdit ? 11 : 9}>
                    Memuat data...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-gray-500 dark:text-gray-400" colSpan={canEdit ? 11 : 9}>
                    {supportsOdpWorkflow ? 'Tidak ada data.' : 'Belum ada data untuk divisi ini di modul PORT ODP.'}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const kapasitas = Number(row.kapasitas ?? 8) || 8
                  const terpakai = Number(row.terpakai ?? 0) || 0
                  const sisa = Math.max(0, kapasitas - terpakai)
                  return (
                    <tr key={row.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                      {canEdit && (
                        <td className="py-3 pr-4 pl-3">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(row.id)}
                            onChange={() => toggleRowSelected(row.id)}
                            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-0 dark:text-gray-100"
                          />
                        </td>
                      )}
                      <td className="py-3 pr-4 pl-3 text-center text-xs text-gray-500 dark:text-gray-400">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="py-3 pr-4 font-semibold">{row.nama_odp}</td>
                      <td className="py-3 pr-4">{row.wilayah || 'Pati'}</td>
                      <td className="py-3 pr-4">
                        {(() => {
                          const hasCoords = Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
                          const parsed = !hasCoords ? parseLatLng(row.lokasi) : null
                          const isClickable = hasCoords || parsed !== null
                          
                          if (isClickable) {
                            const mapRow = hasCoords ? row : { ...row, latitude: parsed!.latitude, longitude: parsed!.longitude }
                            return (
                              <button onClick={() => handleLocationClick(mapRow)} className="text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline decoration-dashed underline-offset-4 transition-colors" title="Lihat di Peta">
                                {row.lokasi}
                              </button>
                            )
                          }
                          return row.lokasi
                        })()}
                      </td>
                      <td className="py-3 pr-4">{kapasitas}</td>
                      <td className={clsx('py-3 pr-4', terpakai >= kapasitas ? 'font-bold text-red-400' : '')}>{terpakai}</td>
                      <td className={clsx('py-3 pr-4', sisa === 0 ? 'font-bold text-red-400' : '')}>{sisa}</td>
                      <td className="py-3 pr-4">
                        <OdpBadge kapasitas={kapasitas} terpakai={terpakai} />
                      </td>
                      <td className="py-3 pr-4">{row.status_tiang || '-'}</td>
                      {canEdit && (
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(row)} disabled={!canMutate} className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => removeRow(row)} disabled={!canMutate} className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-2.5 py-2 text-red-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-red-400 dark:hover:bg-gray-600" title="Hapus">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <div>
            Halaman {page} / {totalPages} · Total {total}
          </div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
              Sebelumnya
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit ODP' : 'Tambah ODP'} onClose={() => setModalOpen(false)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama ODP</label>
            <input value={form.nama_odp} onChange={(e) => setForm((p) => ({ ...p, nama_odp: e.target.value }))} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="ODP-001" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">POP</label>
            <input
              list="odp-wilayah-list"
              value={form.wilayah}
              onChange={(e) => setForm((p) => ({ ...p, wilayah: e.target.value }))}
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="Pati"
            />
            <datalist id="odp-wilayah-list">
              {wilayahList.map((w) => (
                <option key={w} value={w} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Lokasi</label>
            <input value={form.lokasi} onChange={(e) => setForm((p) => ({ ...p, lokasi: e.target.value }))} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="Alamat / patokan lokasi" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Koordinat</label>
            <input
              value={form.koordinat}
              onChange={(e) => setForm((p) => ({ ...p, koordinat: e.target.value }))}
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="-6.888,110.905 atau link Google Maps"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Kapasitas</label>
            <input value={form.kapasitas} onChange={(e) => setForm((p) => ({ ...p, kapasitas: e.target.value }))} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="8" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Terpakai</label>
            <input value={form.terpakai} onChange={(e) => setForm((p) => ({ ...p, terpakai: e.target.value }))} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="0" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status Tiang</label>
            <select value={form.status_tiang} onChange={(e) => setForm((p) => ({ ...p, status_tiang: e.target.value }))} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
              {['Perkasa', 'Numpang', 'n/a'].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
            Batal
          </button>
          <button onClick={save} disabled={saving || !canEdit} className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
            {saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Tambah'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
