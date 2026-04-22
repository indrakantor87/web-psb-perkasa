'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'

type Package = {
  id: number
  name: string
}

export function PackageManager() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newPackageName, setNewPackageName] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/packages')
      if (!res.ok) throw new Error('Failed to fetch packages')
      const data = (await res.json()) as Package[]
      setPackages(data)
    } catch {
      setError('Gagal memuat data paket')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newPackageName.trim()
    if (!name) return

    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed to add package')
      setNewPackageName('')
      await fetchPackages()
    } catch {
      setError('Gagal menambahkan paket')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus paket ini?')) return

    setError('')
    try {
      const res = await fetch(`/api/packages/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete package')
      await fetchPackages()
    } catch {
      setError('Gagal menghapus paket')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 dark:text-white">Master Paket</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="mb-6 sm:mb-8 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Tambah Paket</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nama Paket</label>
            <input
              type="text"
              value={newPackageName}
              onChange={(e) => setNewPackageName(e.target.value)}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="Contoh: HOME LITE"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newPackageName.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Tambah
          </button>
        </div>
      </form>

      <div className="overflow-x-auto shadow-sm ring-1 ring-black/5 dark:ring-gray-700 rounded-2xl w-full">
        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                scope="col"
                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200"
              >
                Nama Paket
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={2} className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : packages.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  Belum ada data paket
                </td>
              </tr>
            ) : (
              packages.map((p) => (
                <tr key={p.id}>
                  <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                  <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      onClick={() => handleDelete(p.id)}
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

