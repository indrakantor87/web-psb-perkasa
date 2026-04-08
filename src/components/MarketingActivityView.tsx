'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { Plus, Edit2, Trash2, X, Search, Calendar } from 'lucide-react'

interface MarketingActivity {
  id: number
  date: string
  marketingName: string
  activity: string
  notes?: string | null
  createdAt: string
  updatedAt: string
}

interface MarketingActivityViewProps {
  userRole: string
  userName: string
}

export function MarketingActivityView({ userRole, userName }: MarketingActivityViewProps) {
  const router = useRouter()
  const [activities, setActivities] = useState<MarketingActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<MarketingActivity | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [marketingSearch, setMarketingSearch] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    marketingName: userRole === 'MARKETING' ? userName : '',
    activity: '',
    notes: '',
  })

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
      })
      if (marketingSearch) params.append('marketing', marketingSearch)
      
      const res = await fetch(`/api/marketing-activities?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data)
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }, [month, year, marketingSearch])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const handleOpenModal = (activity: MarketingActivity | null = null) => {
    if (activity) {
      setEditingActivity(activity)
      setFormData({
        date: format(new Date(activity.date), 'yyyy-MM-dd'),
        marketingName: activity.marketingName,
        activity: activity.activity,
        notes: activity.notes || '',
      })
    } else {
      setEditingActivity(null)
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        marketingName: userRole === 'MARKETING' ? userName : '',
        activity: '',
        notes: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const method = editingActivity ? 'PUT' : 'POST'
      const url = editingActivity 
        ? `/api/marketing-activities/${editingActivity.id}`
        : '/api/marketing-activities'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setIsModalOpen(false)
        fetchActivities()
      } else {
        const error = await res.json()
        alert(error.error || 'Terjadi kesalahan')
      }
    } catch (error) {
      console.error('Failed to submit activity:', error)
      alert('Gagal menyimpan aktivitas')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus aktivitas ini?')) return

    try {
      const res = await fetch(`/api/marketing-activities/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchActivities()
      }
    } catch (error) {
      console.error('Failed to delete activity:', error)
      alert('Gagal menghapus aktivitas')
    }
  }

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  return (
    <div className="space-y-4">
      {/* Filters & Add Button */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {userRole !== 'MARKETING' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cari Marketing</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={marketingSearch}
                  onChange={(e) => setMarketingSearch(e.target.value)}
                  placeholder="Nama marketing..."
                  className="w-full pl-9 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                />
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Tambah Aktivitas
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Marketing</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktivitas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keterangan</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Memuat data...</td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Tidak ada data untuk periode ini</td>
                </tr>
              ) : (
                activities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {format(new Date(activity.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {activity.marketingName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {activity.activity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 italic">
                      {activity.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(activity)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {['ADMIN', 'CS', 'NOC'].includes(userRole) && (
                          <button
                            onClick={() => handleDelete(activity.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingActivity ? 'Edit Aktivitas' : 'Tambah Aktivitas'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Marketing</label>
                  <input
                    type="text"
                    required
                    readOnly={userRole === 'MARKETING'}
                    value={formData.marketingName}
                    onChange={(e) => setFormData({ ...formData, marketingName: e.target.value })}
                    className={clsx(
                      "w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm",
                      userRole === 'MARKETING' && "bg-gray-50 dark:bg-gray-600 cursor-not-allowed"
                    )}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aktivitas</label>
                <textarea
                  required
                  rows={3}
                  value={formData.activity}
                  onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  placeholder="Apa yang dikerjakan hari ini?"
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan tambahan..."
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
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
                  {submitting ? 'Menyimpan...' : (editingActivity ? 'Simpan Perubahan' : 'Tambah Aktivitas')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
