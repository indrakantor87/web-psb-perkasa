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
      setError('Failed to load template data')
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
      setError('Failed to add template')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete template')

      setTemplates(templates.filter(t => t.id !== id))
    } catch {
      setError('Failed to delete template')
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
      setError('Failed to update template')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6 dark:text-white">WhatsApp Template Management</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Add New Form */}
      <form onSubmit={handleAdd} className="mb-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Add New Template</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Template Name</label>
            <input
              type="text"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="Example: Customer Greeting"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Message Content</label>
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
              <span className="font-semibold">Available placeholders:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li><code>{`{{name}}`}</code> - Customer Name</li>
                <li><code>{`{{package}}`}</code> - Package</li>
                <li><code>{`{{marketing}}`}</code> - Marketing Name</li>
                <li><code>{`{{phone}}`}</code> - Phone Number</li>
                <li><code>{`{{location}}`}</code> - Maps Link</li>
              </ul>
            </div>
            <textarea
              value={newTemplate.content}
              onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="Hello {{name}}, confirmation for package {{package}}..."
              rows={3}
            />
          </div>
          <div className="flex items-center">
            <input
              id="isDefault"
              type="checkbox"
              checked={newTemplate.isDefault}
              onChange={(e) => setNewTemplate({ ...newTemplate, isDefault: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              Set as Default
            </label>
          </div>
          <button
            type="submit"
            disabled={adding || !newTemplate.name || !newTemplate.content}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Template
          </button>
        </div>
      </form>

      {/* List */}
      <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Name</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Message Content</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Default</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">Loading...</td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">No templates yet</td>
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
                        className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm p-1"
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
                        className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm p-1"
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
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    ) : (
                      template.isDefault && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Default
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
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title="Save"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(template)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
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
