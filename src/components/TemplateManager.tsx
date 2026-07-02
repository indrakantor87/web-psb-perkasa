'use client'

import { useState, useEffect } from 'react'
import { Trash2, Plus, AlertCircle, Edit2, Check, X } from 'lucide-react'

type WhatsappTemplate = {
  id: number
  name: string
  content: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export function TemplateManager() {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '', isDefault: false })
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', content: '', isDefault: false })

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Failed to fetch templates')
      const data = await res.json()
      setTemplates(data)
    } catch {
      setError('Gagal memuat data template')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTemplate.name || !newTemplate.content) return

    setAdding(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      })

      if (!res.ok) throw new Error('Failed to add template')

      await fetchTemplates()
      setNewTemplate({ name: '', content: '', isDefault: false })
    } catch {
      setError('Gagal menambahkan template')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus template ini?')) return

    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete template')

      await fetchTemplates()
    } catch {
      setError('Gagal menghapus template')
    }
  }

  const startEditing = (template: WhatsappTemplate) => {
    setEditingId(template.id)
    setEditForm({
      name: template.name,
      content: template.content,
      isDefault: template.isDefault
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditForm({ name: '', content: '', isDefault: false })
  }

  const handleUpdate = async (id: number) => {
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (!res.ok) throw new Error('Failed to update template')

      await fetchTemplates()
      setEditingId(null)
    } catch {
      setError('Gagal memperbarui template')
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">Daftar Template</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Simpan format pesan WhatsApp yang sering dipakai agar respons lebih cepat dan seragam.
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
        <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">Tambah Template</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Nama Template
            </label>
            <input
              type="text"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
              placeholder="Contoh: Sapaan Pelanggan"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Isi Pesan
            </label>
            <div className="mb-2 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <span className="font-semibold text-gray-700 dark:text-gray-200">Placeholder yang tersedia:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li><code>{`{{name}}`}</code> - Nama pelanggan</li>
                <li><code>{`{{package}}`}</code> - Paket</li>
                <li><code>{`{{marketing}}`}</code> - Nama marketing</li>
                <li><code>{`{{phone}}`}</code> - Nomor telepon</li>
                <li><code>{`{{location}}`}</code> - Tautan lokasi</li>
              </ul>
            </div>
            <textarea
              value={newTemplate.content}
              onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
              placeholder="Halo {{name}}, konfirmasi paket {{package}}..."
              rows={3}
            />
          </div>
          <div className="flex items-center">
            <input
              id="isDefault"
              type="checkbox"
              checked={newTemplate.isDefault}
              onChange={(e) => setNewTemplate({ ...newTemplate, isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-0 dark:border-gray-600 dark:bg-gray-800"
            />
            <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              Jadikan template utama
            </label>
          </div>
          <button
            type="submit"
            disabled={adding || !newTemplate.name || !newTemplate.content}
            className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:w-auto"
          >
            <Plus className="mr-1 h-4 w-4" />
            Tambah Template
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Nama</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Isi Pesan</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Utama</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">Memuat...</td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada template</td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.id}>
                  <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white align-top w-1/4">
                    {editingId === template.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    ) : (
                      template.name
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap align-top w-1/2">
                    {editingId === template.id ? (
                      <textarea
                        value={editForm.content}
                        onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                        className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        rows={3}
                      />
                    ) : (
                      template.content
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 align-top">
                    {editingId === template.id ? (
                      <input
                        type="checkbox"
                        checked={editForm.isDefault}
                        onChange={(e) => setEditForm({ ...editForm, isDefault: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-0 dark:border-gray-600 dark:bg-gray-800"
                      />
                    ) : (
                      template.isDefault && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                          Template utama
                        </span>
                      )
                    )}
                  </td>
                  <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 align-top">
                    <div className="flex justify-end space-x-2">
                      {editingId === template.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(template.id)}
                            className="rounded-md p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                            title="Simpan"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="rounded-md p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                            title="Batal"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(template)}
                            className="rounded-md p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="rounded-md p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
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
  )
}
