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
        setPrefix(normalizePrefix(category, String(cfg.prefix ?? defaultPrefixForCategory(category))))
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
      setPrefix(normalizePrefix(category, String(cfg.prefix ?? defaultPrefixForCategory(category))))
      setNextNumber(normalizeNextNumber(cfg.nextNumber))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold dark:text-white">Format ID Ticketing</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Atur prefix dan angka berikutnya. Contoh: TT/PKN/01 atau PV/PKN/01.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="flex flex-col">
          <span className="mb-1 text-xs text-gray-500 dark:text-gray-400">Kategori</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            disabled={loading || saving}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm sm:text-sm p-2 border"
          >
            <option value="TT">Trouble Ticket (TT)</option>
            <option value="PV">Preventive (PV)</option>
          </select>
        </div>
        <div className="flex flex-col">
          <span className="mb-1 text-xs text-gray-500 dark:text-gray-400">Prefix</span>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="TT/PKN/"
            disabled={loading || saving}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm sm:text-sm p-2 border"
          />
        </div>
        <div className="flex flex-col">
          <span className="mb-1 text-xs text-gray-500 dark:text-gray-400">Angka Berikutnya</span>
          <input
            type="number"
            min={1}
            max={1_000_000_000}
            value={nextNumber}
            onChange={(e) => setNextNumber(normalizeNextNumber(e.target.value))}
            disabled={loading || saving}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm sm:text-sm p-2 border"
          />
        </div>
        <div className="flex flex-col">
          <span className="mb-1 text-xs text-gray-500 dark:text-gray-400">Preview</span>
          <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
            {normalizePrefix(category, prefix)}
            {formatTicketNumber(nextNumber)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading || saving}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}
