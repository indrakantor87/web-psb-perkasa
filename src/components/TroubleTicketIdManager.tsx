'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Save } from 'lucide-react'

type TicketCategory = 'TT' | 'PV'
type Config = { id: number; category: TicketCategory; prefix: string; nextNumber: number }

function defaultPrefixForCategory(category: TicketCategory) {
  return category === 'PV' ? 'PV/PKN/' : 'TT/PKN/'
}

function normalizePrefix(category: TicketCategory, input: string) {
  const raw = String(input || '').trim()
  if (!raw) return defaultPrefixForCategory(category)
  return raw.endsWith('/') ? raw : `${raw}/`
}

function stripPeriodSuffix(prefix: string) {
  return String(prefix ?? '').replace(/\/\d{2}\.\d{4}\/$/, '/')
}

function normalizeNextNumber(input: unknown) {
  const n = Math.trunc(Number(input))
  if (!Number.isFinite(n) || n < 1) return 1
  if (n > 1_000_000_000) return 1_000_000_000
  return n
}

function formatTicketNumber(n: number) {
  return String(normalizeNextNumber(n)).padStart(2, '0')
}

export function TroubleTicketIdManager() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [category, setCategory] = useState<TicketCategory>('TT')
  const [prefix, setPrefix] = useState('TT/PKN/')
  const [nextNumber, setNextNumber] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/trouble-ticket-id?category=${category}`, { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as unknown
        if (!res.ok) {
          const msg = (data as { error?: string })?.error || 'Gagal memuat konfigurasi ID'
          throw new Error(msg)
        }
        const cfg = data as Config
        setPrefix(stripPeriodSuffix(normalizePrefix(category, String(cfg.prefix ?? defaultPrefixForCategory(category)))))
        setNextNumber(normalizeNextNumber(cfg.nextNumber))
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [category])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/trouble-ticket-id?category=${category}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: normalizePrefix(category, prefix),
          nextNumber: normalizeNextNumber(nextNumber),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) {
        const msg = (data as { error?: string })?.error || 'Gagal menyimpan konfigurasi ID'
        throw new Error(msg)
      }
      const cfg = data as Config
      setPrefix(stripPeriodSuffix(normalizePrefix(category, String(cfg.prefix ?? defaultPrefixForCategory(category)))))
      setNextNumber(normalizeNextNumber(cfg.nextNumber))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-semibold dark:text-white">Format ID Ticketing</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Atur prefix dan angka berikutnya. Contoh: TT/PKN/01 atau PV/PKN/01.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900/40 dark:bg-red-900/30 dark:text-red-200">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="flex flex-col">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Kategori</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            disabled={loading || saving}
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="TT">Trouble Ticket (TT)</option>
            <option value="PV">Preventive (PV)</option>
          </select>
        </div>
        <div className="flex flex-col">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Prefix</span>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="TT/PKN/"
            disabled={loading || saving}
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex flex-col">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Angka Berikutnya</span>
          <input
            type="number"
            min={1}
            max={1_000_000_000}
            value={nextNumber}
            onChange={(e) => setNextNumber(normalizeNextNumber(e.target.value))}
            disabled={loading || saving}
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex flex-col">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview</span>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-700/30 dark:text-gray-200">
            {normalizePrefix(category, prefix)}
            {formatTicketNumber(nextNumber)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end border-t border-gray-100 pt-4 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={loading || saving}
          className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}
