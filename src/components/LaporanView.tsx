'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  Plus,
  X,
  Edit3,
  Trash2,
  Download,
  Upload,
  FileText,
  Loader2,
} from 'lucide-react'
import { Card, cardClassName } from '@/components/ui/Card'

interface ReportItem {
  id: number
  date: string
  ratingGoogleMaps: number | null
  followersInstagram: number | null
  posterProduksi: number | null
  posterPosting: number | null
  videoProduksi: number | null
  videoPosting: number | null
  highPerformingIg: number | null
  highPerformingTiktok: number | null
  messageIg: number | null
  messageGoogleReview: number | null
  kendalaTeknis: string | null
  kendalaNonTeknis: string | null
  keterangan: string | null
  createdById: number | null
  createdBy: { id: number; name: string; username: string } | null
  createdAt: string
  updatedAt: string
}

interface LaporanViewProps {
  userRole: string
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function weekLabelOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  return `Minggu ${Math.floor((day - 1) / 7) + 1}`
}

function dayNameOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return DAY_NAMES[d.getDay()]
}

function formatDateDisplay(dateStr: string): string {
  return format(new Date(dateStr + 'T00:00:00'), 'dd/MM/yyyy')
}

function displayNum(v: number | null): string {
  return v === null || v === undefined ? '-' : String(v)
}

function displayText(v: string | null): string {
  return v && v.trim() ? v : '-'
}

const emptyForm = {
  date: format(new Date(), 'yyyy-MM-dd'),
  ratingGoogleMaps: '',
  followersInstagram: '',
  posterProduksi: '',
  posterPosting: '',
  videoProduksi: '',
  videoPosting: '',
  highPerformingIg: '',
  highPerformingTiktok: '',
  messageIg: '',
  messageGoogleReview: '',
  kendalaTeknis: '',
  kendalaNonTeknis: '',
  keterangan: '',
}

type FormState = typeof emptyForm

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
const LABEL_CLASS = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'

export function LaporanView({ userRole }: LaporanViewProps) {
  const roleUpper = (userRole || '').toUpperCase()
  const canMutate = roleUpper === 'CREATOR_DIGITAL' || roleUpper === 'ADMIN' || roleUpper === 'DEVELOPER'

  const [items, setItems] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/laporan')
      if (!res.ok) throw new Error('Gagal memuat data')
      const data = await res.json()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openCreate = () => {
    setForm({ ...emptyForm, date: format(new Date(), 'yyyy-MM-dd') })
    setEditId(null)
    setIsModalOpen(true)
  }

  const openEdit = (item: ReportItem) => {
    setForm({
      date: item.date,
      ratingGoogleMaps: item.ratingGoogleMaps !== null ? String(item.ratingGoogleMaps) : '',
      followersInstagram: item.followersInstagram !== null ? String(item.followersInstagram) : '',
      posterProduksi: item.posterProduksi !== null ? String(item.posterProduksi) : '',
      posterPosting: item.posterPosting !== null ? String(item.posterPosting) : '',
      videoProduksi: item.videoProduksi !== null ? String(item.videoProduksi) : '',
      videoPosting: item.videoPosting !== null ? String(item.videoPosting) : '',
      highPerformingIg: item.highPerformingIg !== null ? String(item.highPerformingIg) : '',
      highPerformingTiktok: item.highPerformingTiktok !== null ? String(item.highPerformingTiktok) : '',
      messageIg: item.messageIg !== null ? String(item.messageIg) : '',
      messageGoogleReview: item.messageGoogleReview !== null ? String(item.messageGoogleReview) : '',
      kendalaTeknis: item.kendalaTeknis ?? '',
      kendalaNonTeknis: item.kendalaNonTeknis ?? '',
      keterangan: item.keterangan ?? '',
    })
    setEditId(item.id)
    setIsModalOpen(true)
  }

  const handleDelete = async (item: ReportItem) => {
    if (!confirm(`Hapus laporan tanggal ${formatDateDisplay(item.date)}?`)) return
    try {
      const res = await fetch(`/api/laporan/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const url = editId ? `/api/laporan/${editId}` : '/api/laporan'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal menyimpan')
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExport = async () => {
    if (isExporting || items.length === 0) return
    setIsExporting(true)
    try {
      const XLSX = await import('xlsx')
      const rows = items.map((item) => ({
        Minggu: weekLabelOf(item.date),
        Hari: dayNameOf(item.date),
        'Tanggal/Bulan/Tahun': formatDateDisplay(item.date),
        'Rating Google Maps': item.ratingGoogleMaps ?? '',
        'Followers Instagram': item.followersInstagram ?? '',
        'Poster Produksi': item.posterProduksi ?? '',
        'Poster Posting': item.posterPosting ?? '',
        'Video Produksi': item.videoProduksi ?? '',
        'Video Posting': item.videoPosting ?? '',
        'Konten Performa Tinggi IG': item.highPerformingIg ?? '',
        'Konten Performa Tinggi TikTok': item.highPerformingTiktok ?? '',
        'Message IG': item.messageIg ?? '',
        'Message Google Review': item.messageGoogleReview ?? '',
        'Kendala Teknis': item.kendalaTeknis ?? '',
        'Kendala Non-Teknis': item.kendalaNonTeknis ?? '',
        Keterangan: item.keterangan ?? '',
      }))
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan')
      XLSX.writeFile(workbook, `Laporan-Creator-Digital-${format(new Date(), 'yyyyMMdd')}.xlsx`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal export data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/laporan/import', { method: 'POST', body: fd })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal import')
      alert(result.message || 'Import selesai')
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal import')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Build grouped rows for merged-cell display
  const tableRows = useMemo(() => {
    return items.map((item, idx) => {
      const week = weekLabelOf(item.date)
      const day = dayNameOf(item.date)
      const prevWeek = idx > 0 ? weekLabelOf(items[idx - 1].date) : null
      const prevDay = idx > 0 ? dayNameOf(items[idx - 1].date) : null
      const prevDate = idx > 0 ? items[idx - 1].date : null

      // Count how many consecutive rows share the same week label
      let weekSpan = 1
      for (let i = idx + 1; i < items.length; i++) {
        if (weekLabelOf(items[i].date) === week) weekSpan++
        else break
      }
      let daySpan = 1
      for (let i = idx + 1; i < items.length; i++) {
        if (items[i].date === item.date) daySpan++
        else break
      }

      return {
        item,
        showWeek: prevWeek !== week,
        weekSpan,
        showDay: prevDay !== day || prevDate !== item.date,
        daySpan,
      }
    })
  }, [items])

  const thClass =
    'border border-gray-300 bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 whitespace-nowrap'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Laporan Creator Digital</h1>
          <p className="text-sm text-ink-muted">Rekap harian performa konten, rating, followers, dan kendala.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
          {canMutate && (
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import Excel
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={isExporting || items.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Excel
          </button>
          {canMutate && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Tambah Laporan
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <Card className={cardClassName({ className: 'overflow-x-auto' })}>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-ink-muted">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat data...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-muted">
            <FileText className="h-12 w-12 opacity-40" />
            <p>Belum ada data laporan.</p>
            {canMutate && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" /> Tambah Laporan
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className={thClass}>Minggu</th>
                <th rowSpan={2} className={thClass}>Hari</th>
                <th rowSpan={2} className={thClass}>Tanggal</th>
                <th rowSpan={2} className={thClass}>Rating<br />Google Maps</th>
                <th rowSpan={2} className={thClass}>Followers<br />Instagram</th>
                <th colSpan={2} className={thClass}>Poster</th>
                <th colSpan={2} className={thClass}>Video</th>
                <th colSpan={2} className={thClass}>Konten Performa Tinggi</th>
                <th colSpan={2} className={thClass}>Message</th>
                <th colSpan={2} className={thClass}>Kendala</th>
                <th rowSpan={2} className={thClass}>Keterangan</th>
                {canMutate && <th rowSpan={2} className={thClass}>Aksi</th>}
              </tr>
              <tr>
                <th className={thClass}>Produksi</th>
                <th className={thClass}>Posting</th>
                <th className={thClass}>Produksi</th>
                <th className={thClass}>Posting</th>
                <th className={thClass}>IG</th>
                <th className={thClass}>TikTok</th>
                <th className={thClass}>IG</th>
                <th className={thClass}>Google Review</th>
                <th className={thClass}>Teknis</th>
                <th className={thClass}>Non-Teknis</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ item, showWeek, weekSpan, showDay, daySpan }) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  {showWeek && (
                    <td
                      rowSpan={weekSpan}
                      className="border border-gray-200 px-3 py-2 text-center align-middle font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    >
                      {weekLabelOf(item.date)}
                    </td>
                  )}
                  {showDay && (
                    <td
                      rowSpan={daySpan}
                      className="border border-gray-200 px-3 py-2 text-center align-middle text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    >
                      {dayNameOf(item.date)}
                    </td>
                  )}
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {formatDateDisplay(item.date)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.ratingGoogleMaps)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.followersInstagram)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.posterProduksi)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.posterPosting)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.videoProduksi)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.videoPosting)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.highPerformingIg)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.highPerformingTiktok)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.messageIg)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayNum(item.messageGoogleReview)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayText(item.kendalaTeknis)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayText(item.kendalaNonTeknis)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-left align-top text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {displayText(item.keterangan)}
                  </td>
                  {canMutate && (
                    <td className="border border-gray-200 px-3 py-2 text-center align-middle whitespace-nowrap dark:border-gray-700">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-700"
                          title="Edit"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">
                {editId ? 'Edit Laporan' : 'Tambah Laporan'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>Tanggal</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Rating Google Maps</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.ratingGoogleMaps}
                    onChange={(e) => setForm({ ...form, ratingGoogleMaps: e.target.value })}
                    placeholder="4.5"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Followers Instagram</label>
                  <input
                    type="number"
                    value={form.followersInstagram}
                    onChange={(e) => setForm({ ...form, followersInstagram: e.target.value })}
                    placeholder="2429"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Poster Produksi</label>
                  <input
                    type="number"
                    value={form.posterProduksi}
                    onChange={(e) => setForm({ ...form, posterProduksi: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Poster Posting</label>
                  <input
                    type="number"
                    value={form.posterPosting}
                    onChange={(e) => setForm({ ...form, posterPosting: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Video Produksi</label>
                  <input
                    type="number"
                    value={form.videoProduksi}
                    onChange={(e) => setForm({ ...form, videoProduksi: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Video Posting</label>
                  <input
                    type="number"
                    value={form.videoPosting}
                    onChange={(e) => setForm({ ...form, videoPosting: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Performa IG</label>
                  <input
                    type="number"
                    value={form.highPerformingIg}
                    onChange={(e) => setForm({ ...form, highPerformingIg: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Performa TikTok</label>
                  <input
                    type="number"
                    value={form.highPerformingTiktok}
                    onChange={(e) => setForm({ ...form, highPerformingTiktok: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Message IG</label>
                  <input
                    type="number"
                    value={form.messageIg}
                    onChange={(e) => setForm({ ...form, messageIg: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Message Google Review</label>
                  <input
                    type="number"
                    value={form.messageGoogleReview}
                    onChange={(e) => setForm({ ...form, messageGoogleReview: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Kendala Teknis</label>
                  <input
                    type="text"
                    value={form.kendalaTeknis}
                    onChange={(e) => setForm({ ...form, kendalaTeknis: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Kendala Non-Teknis</label>
                  <input
                    type="text"
                    value={form.kendalaNonTeknis}
                    onChange={(e) => setForm({ ...form, kendalaNonTeknis: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_CLASS}>Keterangan</label>
                <textarea
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                  rows={3}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editId ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
