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
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">Daftar Paket</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tambah atau hapus paket yang tersedia di form Input PSB.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="mr-2 h-5 w-5" />
          {error}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900 sm:mb-8 sm:p-4"
      >
        <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">Tambah Paket</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
          <div className="flex-1 w-full">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Nama Paket
            </label>
            <input
              type="text"
              value={newPackageName}
              onChange={(e) => setNewPackageName(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
              placeholder="Contoh: HOME LITE"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newPackageName.trim()}
            className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:w-auto"
          >
            <Plus className="mr-1 h-4 w-4" />
            Tambah
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                scope="col"
                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200"
              >
                Nama Paket
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={2} className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  Memuat...
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
                      className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                      title="Hapus paket"
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
