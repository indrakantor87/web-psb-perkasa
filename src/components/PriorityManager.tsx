
'use client'

import { useState, useEffect } from 'react'
import { Trash2, Plus, AlertCircle } from 'lucide-react'

type Priority = {
  id: number
  name: string
  color: string
}

export function PriorityManager() {
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newPriority, setNewPriority] = useState({ name: '', color: '' })
  const [adding, setAdding] = useState(false)

  const fetchPriorities = async () => {
    try {
      const res = await fetch('/api/priorities')
      if (!res.ok) throw new Error('Failed to fetch priorities')
      const data = await res.json()
      setPriorities(data)
    } catch (err) {
      setError('Gagal memuat data prioritas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPriorities()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPriority.name || !newPriority.color) return

    setAdding(true)
    try {
      const res = await fetch('/api/priorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPriority),
      })

      if (!res.ok) throw new Error('Failed to add priority')

      await fetchPriorities()
      setNewPriority({ name: '', color: '' })
    } catch (err) {
      setError('Gagal menambah prioritas')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus prioritas ini?')) return

    try {
      const res = await fetch(`/api/priorities/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete priority')

      setPriorities(priorities.filter(p => p.id !== id))
    } catch (err) {
      setError('Gagal menghapus prioritas')
    }
  }

  const predefinedColors = [
    { name: 'Merah', value: 'bg-red-600 text-white' },
    { name: 'Kuning', value: 'bg-yellow-600 text-white' },
    { name: 'Biru', value: 'bg-blue-600 text-white' },
    { name: 'Hitam', value: 'bg-gray-800 text-white' },
    { name: 'Cokelat', value: 'bg-amber-600 text-white' },
    { name: 'Hijau', value: 'bg-green-600 text-white' },
    { name: 'Ungu', value: 'bg-purple-600 text-white' },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6 dark:text-white">Manajemen Prioritas</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Add New Form */}
      <form onSubmit={handleAdd} className="mb-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Tambah Prioritas Baru</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nama Prioritas</label>
            <input
              type="text"
              value={newPriority.name}
              onChange={(e) => setNewPriority({ ...newPriority, name: e.target.value })}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="Contoh: Urgent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Warna Badge (Tailwind Class)</label>
            <select
              value={newPriority.color}
              onChange={(e) => setNewPriority({ ...newPriority, color: e.target.value })}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            >
              <option value="">Pilih Warna</option>
              {predefinedColors.map((c) => (
                <option key={c.name} value={c.value}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !newPriority.name || !newPriority.color}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Tambah
          </button>
        </div>
      </form>

      {/* List */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg w-fit">
        <table className="divide-y divide-gray-300 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Nama</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Preview Badge</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={3} className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">Loading...</td>
              </tr>
            ) : priorities.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">Belum ada data prioritas</td>
              </tr>
            ) : (
              priorities.map((priority) => (
                <tr key={priority.id}>
                  <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white">{priority.name}</td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${priority.color}`}>
                      {priority.name}
                    </span>
                  </td>
                  <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      onClick={() => handleDelete(priority.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
