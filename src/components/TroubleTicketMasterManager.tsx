'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { Trash2, Plus } from 'lucide-react'

type Kind = 'PROBLEM_CATEGORY' | 'RESOLUTION_ACTION'

type Row = { id: number; value: string }

function normalizeValue(v: string) {
  return v.trim().replace(/\s+/g, ' ').toUpperCase()
}

function formatLabel(v: string) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

async function fetchList(kind: Kind, signal?: AbortSignal) {
  const res = await fetch(`/api/trouble-tickets/master?kind=${encodeURIComponent(kind)}`, { cache: 'no-store', signal })
  const data = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) throw new Error((data as { error?: string })?.error || 'Gagal memuat master data')
  return (Array.isArray(data) ? data : []) as Row[]
}

async function addValue(kind: Kind, value: string) {
  const res = await fetch('/api/trouble-tickets/master', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, value }),
  })
  const data = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) throw new Error((data as { error?: string })?.error || 'Gagal menambah')
}

async function deleteValue(id: number) {
  const res = await fetch(`/api/trouble-tickets/master?id=${id}`, { method: 'DELETE' })
  const data = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) throw new Error((data as { error?: string })?.error || 'Gagal menghapus')
}

function Section({
  title,
  kind,
  rows,
  loading,
  onAdd,
  onDelete,
}: {
  title: string
  kind: Kind
  rows: Row[]
  loading: boolean
  onAdd: (kind: Kind, value: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = loading || saving

  const handleAdd = async () => {
    if (disabled) return
    const v = normalizeValue(value)
    if (!v) {
      setError('Nama wajib diisi')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onAdd(kind, v)
      setValue('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (disabled) return
    if (!confirm('Hapus item ini?')) return
    setSaving(true)
    setError(null)
    try {
      await onDelete(id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{title}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Kelola daftar untuk dropdown Trouble Ticket.</div>
        </div>
        <div className="flex w-full max-w-lg flex-col gap-2 md:flex-row md:items-center">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Tambah item baru..."
            disabled={disabled}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Nama
              </th>
              <th className="px-2 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={2} className="px-2 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Memuat...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-2 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Belum ada data
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-2 py-2 text-sm text-gray-800 dark:text-gray-200">{formatLabel(r.value)}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      disabled={disabled}
                      className={clsx(
                        'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold',
                        'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
                        'dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-200 dark:hover:bg-red-900/20',
                        disabled && 'opacity-50'
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus
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

export function TroubleTicketMasterManager() {
  const [loading, setLoading] = useState(true)
  const [problemRows, setProblemRows] = useState<Row[]>([])
  const [actionRows, setActionRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const [p, a] = await Promise.all([
        fetchList('PROBLEM_CATEGORY', signal),
        fetchList('RESOLUTION_ACTION', signal),
      ])
      setProblemRows(p)
      setActionRows(a)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const handlers = useMemo(() => {
    return {
      onAdd: async (kind: Kind, value: string) => {
        await addValue(kind, value)
        await load()
      },
      onDelete: async (id: number) => {
        await deleteValue(id)
        await load()
      },
    }
  }, [load])

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-200">
          {error}
        </div>
      )}
      <Section title="Master Jenis Gangguan" kind="PROBLEM_CATEGORY" rows={problemRows} loading={loading} {...handlers} />
      <Section title="Master Tindakan" kind="RESOLUTION_ACTION" rows={actionRows} loading={loading} {...handlers} />
    </div>
  )
}

