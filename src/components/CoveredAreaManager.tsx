'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, X, MapPin } from 'lucide-react'

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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  const fetchAreas = async () => {
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
  }

  useEffect(() => {
    fetchAreas()
  }, [])

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          Master Data Area Tercover
        </h2>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Tambah Area
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Area</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keterangan</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">Memuat data...</td>
              </tr>
            ) : areas.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">Belum ada area terdaftar</td>
              </tr>
            ) : (
              areas.map((area) => (
                <tr key={area.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                    {area.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {area.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleOpenModal(area)}
                        className="text-blue-600 hover:text-blue-900 p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(area.id)}
                        className="text-red-600 hover:text-red-900 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingArea ? 'Edit Area' : 'Tambah Area Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Area</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Misal: Sidomukti"
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan (Opsional)</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Catatan tambahan tentang area ini..."
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
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
