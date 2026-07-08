'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'

type SecurityLogItem = {
  id: number
  monthKey: string
  createdAt: string
  userId: number | null
  username: string | null
  role: string | null
  action: string
  path: string | null
  method: string | null
  ip: string | null
  userAgent: string | null
  meta: unknown
}

function currentMonthKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

export function SecurityLogsClient() {
  const [month, setMonth] = useState(currentMonthKey())
  const [user, setUser] = useState('')
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<SecurityLogItem[]>([])

  const monthOptions = useMemo(() => {
    const out: string[] = []
    const d = new Date()
    for (let i = 0; i < 6; i++) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      out.push(`${y}-${m}`)
      d.setMonth(d.getMonth() - 1)
    }
    return out
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (month) params.set('month', month)
      if (user.trim()) params.set('user', user.trim())
      if (action.trim()) params.set('action', action.trim())
      params.set('limit', '200')
      const res = await fetch(`/api/security-logs?${params.toString()}`, { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as { items?: SecurityLogItem[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal memuat log aktivitas')
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [action, month, user])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">Bulan</div>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {monthOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">User (username / id)</div>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="contoh: marketing1"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">Aksi</div>
              <input
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="contoh: LOGIN_SUCCESS"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void fetchLogs()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-200">{error}</div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
          Log Aktivitas (max 200)
        </div>

        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-300">Memuat...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-300">Tidak ada data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr className="text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <th className="px-3 py-2">Waktu</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Aksi</th>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={clsx('border-t border-gray-100 dark:border-gray-800', row.action.includes('FAILED') && 'bg-red-50 dark:bg-red-950')}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-gray-100">{formatDateTime(row.createdAt)}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                      <div className="font-semibold">{row.username || '-'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{row.userId != null ? `ID ${row.userId}` : ''}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.role || '-'}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.action}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{row.path || '-'}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200 whitespace-nowrap">{row.ip || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

