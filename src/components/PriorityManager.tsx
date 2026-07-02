
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
    } catch {
      setError('Failed to load priority data')
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
    } catch {
      setError('Failed to add priority')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this priority?')) return

    try {
      const res = await fetch(`/api/priorities/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete priority')

      await fetchPriorities()
    } catch {
      setError('Failed to delete priority')
    }
  }

  const predefinedColors = [
    { name: 'Red', value: 'bg-red-600 text-white' },
    { name: 'Yellow', value: 'bg-yellow-600 text-white' },
    { name: 'Blue', value: 'bg-blue-600 text-white' },
    { name: 'Black', value: 'bg-gray-800 text-white' },
    { name: 'Brown', value: 'bg-amber-600 text-white' },
    { name: 'Green', value: 'bg-green-600 text-white' },
    { name: 'Purple', value: 'bg-purple-600 text-white' },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">Daftar Prioritas</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Atur nama prioritas dan warna badge yang tampil pada ticket.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900/40 dark:bg-red-900/30 dark:text-red-200">
          <AlertCircle className="mr-2 h-5 w-5" />
          {error}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 sm:mb-8 sm:p-4"
      >
        <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">Tambah Prioritas</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
          <div className="flex-1 w-full">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Nama Prioritas
            </label>
            <input
              type="text"
              value={newPriority.name}
              onChange={(e) => setNewPriority({ ...newPriority, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
              placeholder="Contoh: Urgent"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Warna Badge
            </label>
            <select
              value={newPriority.color}
              onChange={(e) => setNewPriority({ ...newPriority, color: e.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
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
            className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:w-auto"
          >
            <Plus className="mr-1 h-4 w-4" />
            Tambah
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Nama</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Preview Badge</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">Memuat...</td>
              </tr>
            ) : priorities.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data prioritas</td>
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
                      className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                      title="Hapus prioritas"
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
