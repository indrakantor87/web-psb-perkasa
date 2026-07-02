'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, X, MapPin, Download, Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

interface CoveredArea {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export function CoveredAreaManager() {
  const [areas, setAreas] = useState<CoveredArea[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingArea, setEditingArea] = useState<CoveredArea | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  const fetchAreas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/covered-areas')
      if (res.ok) {
        const data = await res.json()
        setAreas(data)
      }
    } catch (error) {
      console.error('Failed to fetch areas:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAreas()
  }, [fetchAreas])

  // Pull to refresh support
  useEffect(() => {
    const handler = (ev: Event) => {
      const customEv = ev as CustomEvent
      if (customEv.detail && typeof customEv.detail.register === 'function') {
        customEv.detail.register(fetchAreas())
      } else {
        fetchAreas()
      }
    }
    window.addEventListener('app:refresh', handler)
    return () => window.removeEventListener('app:refresh', handler)
  }, [fetchAreas])

  const handleOpenModal = (area: CoveredArea | null = null) => {
    if (area) {
      setEditingArea(area)
      setFormData({
        name: area.name,
        description: area.description || '',
      })
    } else {
      setEditingArea(null)
      setFormData({
        name: '',
        description: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const method = editingArea ? 'PUT' : 'POST'
      const url = editingArea 
        ? `/api/covered-areas/${editingArea.id}`
        : '/api/covered-areas'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setIsModalOpen(false)
        fetchAreas()
      } else {
        const error = await res.json()
        alert(error.error || 'Terjadi kesalahan')
      }
    } catch (error) {
      console.error('Failed to submit area:', error)
      alert('Gagal menyimpan area')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus area ini?')) return

    try {
      const res = await fetch(`/api/covered-areas/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchAreas()
      } else {
        const error = await res.json()
        alert(error.error || 'Gagal menghapus area')
      }
    } catch (error) {
      console.error('Failed to delete area:', error)
      alert('Gagal menghapus area')
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const XLSX = await import('xlsx')
      const dataToExport = areas.map(a => ({
        'Nama Area': a.name,
        'Keterangan': a.description || '-'
      }))

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Area')
      XLSX.writeFile(workbook, `Master_Area_Covered_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (error) {
      console.error('Export error:', error)
      alert('Gagal export data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/covered-areas/import', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const result = await res.json()
        alert(result.message)
        fetchAreas()
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

  const totalPages = Math.ceil(areas.length / pageSize)
  const indexOfLastItem = currentPage * pageSize
  const indexOfFirstItem = indexOfLastItem - pageSize
  const currentItems = areas.slice(indexOfFirstItem, indexOfLastItem)

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            Master Area Tercover
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola area yang dipakai untuk pencatatan dan analisis kunjungan marketing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            disabled={isImporting}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:flex-none"
            onClick={() => document.getElementById('area-import-input')?.click()}
          >
            <Upload className="h-4 w-4" />
            {isImporting ? 'Mengimpor...' : 'Import'}
          </button>
          <input
            id="area-import-input"
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleImport}
          />
          <button
            onClick={handleExport}
            disabled={isExporting || areas.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:flex-none"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Mengekspor...' : 'Export'}
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:flex-none"
          >
            <Plus className="h-4 w-4" />
            Tambah Area
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Area</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keterangan</th>
              <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500">Memuat data...</td>
              </tr>
            ) : currentItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500">Belum ada area terdaftar</td>
              </tr>
            ) : (
              currentItems.map((area, index) => (
                <tr key={area.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {indexOfFirstItem + index + 1}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase">
                    {area.name}
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {area.description || '-'}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleOpenModal(area)}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(area.id)}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Pagination Controls */}
      {!loading && areas.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Menampilkan <span className="font-medium">{indexOfFirstItem + 1}</span> sampai{' '}
            <span className="font-medium">{Math.min(indexOfLastItem, areas.length)}</span> dari{' '}
            <span className="font-medium">{areas.length}</span> area
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-gray-300 p-2 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={clsx(
                    'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                    currentPage === page
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-gray-300 p-2 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in zoom-in duration-200 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingArea ? 'Edit Area' : 'Tambah Area'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama Area</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Misal: Sidomukti"
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Keterangan</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Catatan tambahan tentang area ini..."
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {submitting ? 'Menyimpan...' : (editingArea ? 'Simpan Perubahan' : 'Tambah Area')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
