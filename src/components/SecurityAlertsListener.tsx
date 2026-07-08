'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'

type AlertRow = {
  id: number
  createdAt: string
  userId: number | null
  username: string | null
  ip: string | null
  userAgent: string | null
  meta: unknown
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

function readLastSeenId() {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem('securityAlerts:lastSeenId')
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function writeLastSeenId(value: number) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('securityAlerts:lastSeenId', String(value))
}

export function SecurityAlertsListener() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxId = useMemo(() => items.reduce((acc, row) => (row.id > acc ? row.id : acc), 0), [items])

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const poll = async () => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      try {
        const sinceId = readLastSeenId()
        const params = new URLSearchParams()
        if (sinceId > 0) params.set('sinceId', String(sinceId))
        params.set('limit', '20')
        const res = await fetch(`/api/security-logs/alerts?${params.toString()}`, { cache: 'no-store' })
        const data = (await res.json().catch(() => ({}))) as { items?: AlertRow[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Gagal memuat alert keamanan')
        const next = Array.isArray(data.items) ? data.items : []
        if (!cancelled && next.length > 0) {
          setItems(next)
          setOpen(true)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
        if (!cancelled) timer = window.setTimeout(poll, 60000)
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    if (maxId > 0) writeLastSeenId(maxId)
    setOpen(false)
    setItems([])
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleDismiss} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-red-300 bg-white shadow-xl dark:border-red-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="text-sm font-bold text-gray-900 dark:text-white">Alert Keamanan: Login dari IP Baru</div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Tutup
          </button>
        </div>

        <div className="space-y-3 p-4">
          {error && <div className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-200">{error}</div>}
          <div className="text-xs text-gray-600 dark:text-gray-300">
            {loading ? 'Memuat...' : 'Ada login sukses role Marketing dari IP yang belum pernah tercatat bulan ini.'}
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {items.map((row) => (
              <div key={row.id} className={clsx('rounded-lg border p-3', 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.username || '-'}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">{formatDateTime(row.createdAt)}</div>
                  </div>
                  <div className="text-xs font-semibold text-red-700 dark:text-red-200 whitespace-nowrap">{row.ip || '-'}</div>
                </div>
                <div className="mt-2 text-xs text-gray-700 dark:text-gray-200 break-words">{row.userAgent || '-'}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/settings/security-logs"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              Buka Log Aktivitas
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Tandai Sudah Dilihat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

