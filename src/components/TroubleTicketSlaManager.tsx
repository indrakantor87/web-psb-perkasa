'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Plus, Save } from 'lucide-react'

type Row = { id: number; type: string; durationDays: number }

function normalizeTypeLabel(type: string) {
  const t = (type || '').toUpperCase()
  if (t === 'EMERGENCY') return 'Emergency'
  if (t === 'MAJOR') return 'Major'
  if (t === 'MINOR') return 'Minor'
  return String(type || '')
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function normalizeTypeKey(type: string) {
  return String(type || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
}

export function TroubleTicketSlaManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newType, setNewType] = useState('')
  const [newDays, setNewDays] = useState(2)

  const fetchRows = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/trouble-ticket-sla')
      const data = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) {
        const msg = (data as { error?: string })?.error || 'Gagal memuat konfigurasi'
        throw new Error(msg)
      }
      setRows((Array.isArray(data) ? data : []) as Row[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
  }, [])

  const hasRows = rows.length > 0

  const itemsToSave = useMemo(
    () => rows.map((r) => ({ type: r.type, durationDays: r.durationDays })),
    [rows]
  )

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/trouble-ticket-sla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSave }),
      })
      const data = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) {
        const msg = (data as { error?: string })?.error || 'Gagal menyimpan konfigurasi'
        throw new Error(msg)
      }
      setRows((Array.isArray(data) ? data : []) as Row[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleAddType = () => {
    const typeKey = normalizeTypeKey(newType)
    if (!typeKey) {
      setError('Type tidak boleh kosong')
      return
    }
    const days = Math.trunc(Number(newDays))
    const clamped = Number.isFinite(days) ? Math.max(1, Math.min(30, days)) : 1

    setRows((prev) => {
      const exists = prev.some((r) => r.type.toUpperCase() === typeKey)
      if (exists) {
        return prev.map((r) => (r.type.toUpperCase() === typeKey ? { ...r, durationDays: clamped } : r))
      }
      const tempId = -Math.abs(Date.now())
      return [{ id: tempId, type: typeKey, durationDays: clamped }, ...prev]
    })
    setNewType('')
    setNewDays(2)
    setError('')
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-semibold dark:text-white">Trouble Ticket Durasi (SLA)</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Atur durasi per tipe untuk menentukan Overdue. Contoh: Emergency 2 hari → tiket OPEN lebih dari 2 hari akan dihitung overdue.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700">
        <div className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Tambah Type</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Type</span>
            <input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="Contoh: Emergency / Major / Minor"
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex flex-col">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Durasi (Hari)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={newDays}
              onChange={(e) => setNewDays(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddType}
              disabled={loading || saving}
              className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Type</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Durasi (Hari)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={2} className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Memuat...</td>
              </tr>
            ) : !hasRows ? (
              <tr>
                <td colSpan={2} className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">Tidak ada data</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-3.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-200">
                    {normalizeTypeLabel(r.type)}
                  </td>
                  <td className="px-3 py-3.5">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={r.durationDays}
                      onChange={(e) => {
                        const n = Math.trunc(Number(e.target.value))
                        const clamped = Number.isFinite(n) ? Math.max(1, Math.min(30, n)) : 1
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, durationDays: clamped } : x)))
                      }}
                      className="w-28 rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end border-t border-gray-100 pt-4 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving || loading || !hasRows}
          className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}
