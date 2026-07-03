'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { Pencil } from 'lucide-react'

type DivisionFilter = 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'
type TicketFilter = 'ALL' | 'WITH' | 'WITHOUT'

type DismantleItem = {
  id: number
  customerName: string
  customerAddress: string | null
  customerPhone: string | null
  userEmail?: string | null
  marketing?: string | null
  radboox?: string | null
  isolationDate: string
  reason?: string | null
  status: string
  ticketDismantle?: string | null
  ticket?: {
    locationMap?: string | null
    description?: string | null
  } | null
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
}: {
  userRole: string
  initialDivision?: DivisionFilter
}) {
  const roleUpper = (userRole || '').toUpperCase()
  const isAdmin = roleUpper === 'ADMIN'
  const canEdit = ['ADMIN', 'CS', 'NOC'].includes(roleUpper)

  const [division, setDivision] = useState<DivisionFilter>(initialDivision)
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
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedRow, setSelectedRow] = useState<DismantleItem | null>(null)
  const [ticketValue, setTicketValue] = useState('')

  const supportsWorkflow = !isAdmin || division === 'ALL' || division === 'CS_ADMIN'
  const divisionDescriptions: Record<DivisionFilter, string> = {
    ALL: 'Menampilkan seluruh data dismantle dari perspektif umum tanpa pembatasan divisi.',
    PENJUALAN: 'Belum ada relasi operasional langsung antara divisi Penjualan dan modul Dismantle Perangkat.',
    CS_ADMIN: 'Fokus ke pelanggan isolir aktif yang membutuhkan tindak lanjut tiket dismantle oleh CS & Admin CS.',
    NOC_TROUBLESHOOTS: 'Divisi NOC & Troubleshoots tidak memakai modul dismantle sebagai alur utama saat ini.',
    CREATOR_DIGITAL: 'Belum ada relasi operasional langsung antara Creator Digital dan modul Dismantle Perangkat.',
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, division, limit, radbooxFilter, ticketFilter])

  const fetchRows = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('status', 'OPEN')
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (radbooxFilter !== 'ALL') params.set('radboox', radbooxFilter)
      if (ticketFilter !== 'ALL') params.set('ticketStatus', ticketFilter)
      if (isAdmin && division !== 'ALL') params.set('division', division)

      const res = await fetch(`/api/isolations?${params.toString()}`, { cache: 'no-store', signal })
      const data = (await res.json().catch(() => ({}))) as {
        items?: DismantleItem[]
        total?: number
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data dismantle')
      setRows(Array.isArray(data.items) ? data.items : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : String(err))
      setRows([])
      setTotal(0)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [debouncedSearch, division, isAdmin, limit, page, radbooxFilter, ticketFilter])

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

  const filledCount = useMemo(
    () => rows.filter((row) => String(row.ticketDismantle ?? '').trim() !== '').length,
    [rows]
  )
  const emptyCount = rows.length - filledCount
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const openEdit = (row: DismantleItem) => {
    setSelectedRow(row)
    setTicketValue(String(row.ticketDismantle ?? ''))
    setModalOpen(true)
  }

  const saveTicket = async () => {
    if (!selectedRow) return
    setSaving(true)
    try {
      const res = await fetch(`/api/isolations/${selectedRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketDismantle: ticketValue }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan ticket dismantle')
      setModalOpen(false)
      setSelectedRow(null)
      await fetchRows()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Konteks Divisi</div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{divisionDescriptions[division]}</p>
          </div>
          {isAdmin && (
            <div className="w-full max-w-xs">
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
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Data</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{total}</div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Pelanggan isolir aktif yang masuk alur dismantle.</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Sudah Ada Ticket</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{filledCount}</div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Jumlah pada halaman saat ini yang sudah memiliki nomor ticket.</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Belum Ada Ticket</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{emptyCount}</div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Bisa langsung diisi dari modul ini tanpa masuk ke halaman Isolir.</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.7fr]">
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
              value={ticketFilter}
              onChange={(e) => setTicketFilter(e.target.value as TicketFilter)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="ALL">Semua</option>
              <option value="WITHOUT">Belum Ada Ticket</option>
              <option value="WITH">Sudah Ada Ticket</option>
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
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tampil</label>
            <select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="75">75</option>
              <option value="100">100</option>
            </select>
          </div>
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

        <div className="mt-4 overflow-x-auto rounded-lg border border-green-700 dark:border-green-700">
          <table className="min-w-full border-collapse">
            <thead className="bg-green-700 dark:bg-green-800">
              <tr>
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
                  <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Memuat data dismantle...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {supportsWorkflow ? 'Belum ada data dismantle yang sesuai filter.' : 'Belum ada data untuk divisi ini.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const hasTicket = String(row.ticketDismantle ?? '').trim() !== ''
                  const mapsUrl = String(row.ticket?.locationMap ?? '').trim()
                  const problemText = String(row.ticket?.description ?? row.radboox ?? '').trim()
                  const rowTone = getRowTone(row)
                  const textTone = getCellTextTone(row)
                  return (
                    <tr key={row.id} className={clsx('align-top', rowTone)}>
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
                      <td className={clsx('border border-green-900 px-2 py-2 text-xs font-medium', textTone)}>{row.customerName || '-'}</td>
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
                        <div className="max-w-xs whitespace-pre-wrap break-words">{row.reason || `Isolir sejak ${formatDate(row.isolationDate)}.`}</div>
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
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          disabled={!canEdit || !supportsWorkflow}
                          className="inline-flex items-center gap-2 rounded-md border border-blue-700 bg-blue-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {hasTicket ? 'Edit Ticket' : 'Isi Ticket'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Halaman {page} / {totalPages} · Total {total}
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
              placeholder="Contoh: DSM-2026-001"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Kosongkan field ini jika ticket dismantle belum dibuat atau ingin dihapus.
            </p>
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
