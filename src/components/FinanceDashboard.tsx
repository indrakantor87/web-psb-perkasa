'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FileSpreadsheet, RefreshCw, Save, Upload } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'

type ReportEntry = {
  reportDate: string
  totalPsbList: number
  installationQueue: number
  installedToday: number
  totalCustomers: number
  activeCustomers: number
  isolationContinued: number
  isolationNotContinued: number
  dismantleOpen: number
  dismantleClosed: number
  customerDeclinePercent: number
  source: string
  updatedAt: string
}

type ReportForm = {
  reportDate: string
  totalPsbList: string
  installationQueue: string
  installedToday: string
  totalCustomers: string
  activeCustomers: string
  isolationContinued: string
  isolationNotContinued: string
  dismantleOpen: string
  dismantleClosed: string
  customerDeclinePercent: string
}

const countFields = [
  ['totalPsbList', 'Total List PSB'],
  ['installationQueue', 'Antrian Pasang'],
  ['installedToday', 'Terpasang hari ini'],
  ['totalCustomers', 'Total pelanggan'],
  ['activeCustomers', 'Total pelanggan aktif'],
  ['isolationContinued', 'Isolir masih dilanjutkan'],
  ['isolationNotContinued', 'Isolir tidak dilanjutkan'],
  ['dismantleOpen', 'Dismantle open'],
  ['dismantleClosed', 'Dismantle closed hari ini'],
] as const

const numberFormatter = new Intl.NumberFormat('id-ID')

function jakartaTodayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function emptyForm(reportDate: string): ReportForm {
  return {
    reportDate,
    totalPsbList: '0',
    installationQueue: '0',
    installedToday: '0',
    totalCustomers: '0',
    activeCustomers: '0',
    isolationContinued: '0',
    isolationNotContinued: '0',
    dismantleOpen: '0',
    dismantleClosed: '0',
    customerDeclinePercent: '0',
  }
}

function toForm(entry: ReportEntry): ReportForm {
  return {
    reportDate: entry.reportDate,
    totalPsbList: String(entry.totalPsbList),
    installationQueue: String(entry.installationQueue),
    installedToday: String(entry.installedToday),
    totalCustomers: String(entry.totalCustomers),
    activeCustomers: String(entry.activeCustomers),
    isolationContinued: String(entry.isolationContinued),
    isolationNotContinued: String(entry.isolationNotContinued),
    dismantleOpen: String(entry.dismantleOpen),
    dismantleClosed: String(entry.dismantleClosed),
    customerDeclinePercent: String(entry.customerDeclinePercent),
  }
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatUpdatedAt(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  })
}

export function FinanceDashboard({ canManage }: { canManage: boolean }) {
  const [entries, setEntries] = useState<ReportEntry[]>([])
  const [form, setForm] = useState<ReportForm>(() => emptyForm(jakartaTodayKey()))
  const [formOpen, setFormOpen] = useState(false)
  const [formExisting, setFormExisting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/gm-daily-report?days=31', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat laporan.')
      setEntries(Array.isArray(payload.entries) ? payload.entries : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat laporan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const latest = entries.at(-1) ?? null

  const loadFormDate = async (reportDate: string) => {
    setForm((current) => ({ ...current, reportDate }))
    setFormExisting(false)
    if (!reportDate) return
    try {
      const response = await fetch(`/api/gm-daily-report?date=${encodeURIComponent(reportDate)}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat rekap tanggal tersebut.')
      if (payload.entry) {
        setForm(toForm(payload.entry))
        setFormExisting(true)
      } else {
        setForm(emptyForm(reportDate))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat rekap tanggal tersebut.')
    }
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const payload = {
      reportDate: form.reportDate,
      totalPsbList: Number(form.totalPsbList),
      installationQueue: Number(form.installationQueue),
      installedToday: Number(form.installedToday),
      totalCustomers: Number(form.totalCustomers),
      activeCustomers: Number(form.activeCustomers),
      isolationContinued: Number(form.isolationContinued),
      isolationNotContinued: Number(form.isolationNotContinued),
      dismantleOpen: Number(form.dismantleOpen),
      dismantleClosed: Number(form.dismantleClosed),
      customerDeclinePercent: Number(form.customerDeclinePercent),
    }

    try {
      const response = await fetch('/api/gm-daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Gagal menyimpan rekap.')
      setMessage(`Rekap ${formatDateLabel(form.reportDate)} berhasil ${formExisting ? 'diperbarui' : 'disimpan'}. Tabel Detail Data Harian otomatis diperbarui.`)
      setFormExisting(true)
      await loadEntries()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan rekap.')
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async (event: FormEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setImporting(true)
    setError('')
    setMessage('')
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/gm-daily-report/import', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Gagal mengimpor file.')
      setMessage(result.message || 'Impor laporan selesai.')
      await loadEntries()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Gagal mengimpor file.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="space-y-4 pb-10" aria-labelledby="finance-dashboard-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          title="Dashboard Admin Billing"
          description="Input rekap PSB & Isolir harian, lalu lihat Detail Data Harian yang otomatis diperbarui"
          badge={latest ? `Data terbaru ${formatDateLabel(latest.reportDate)}` : 'Belum ada rekap'}
          className="mb-0"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadEntries()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Perbarui
          </button>
          {canManage && (
            <>
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted">
                <Upload className="h-4 w-4" />
                {importing ? 'Mengimpor...' : 'Impor Excel/CSV'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  disabled={importing}
                  onChange={(event) => void handleImport(event)}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !formOpen
                  setFormOpen(nextOpen)
                  if (nextOpen) void loadFormDate(jakartaTodayKey())
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {formOpen ? 'Tutup form' : 'Input rekap PSB & Isolir'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </div>
      )}

      {canManage && formOpen && (
        <Card className="p-4 sm:p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Input rekap PSB &amp; Isolir</h3>
                <p className="text-sm text-ink-muted">Menyimpan kembali tanggal yang sama akan memperbarui rekap, bukan membuat duplikat. Data otomatis muncul di Detail Data Harian.</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                Tanggal
                <input
                  type="date"
                  value={form.reportDate}
                  max={jakartaTodayKey()}
                  onChange={(event) => void loadFormDate(event.target.value)}
                  required
                  className="min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {countFields.map(([name, label]) => (
                <label key={name} className="space-y-1.5 text-sm font-medium text-ink">
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form[name]}
                    onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                    className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm tabular-nums text-ink"
                  />
                </label>
              ))}
              <label className="space-y-1.5 text-sm font-medium text-ink">
                <span>Penurunan pelanggan (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={form.customerDeclinePercent}
                  onChange={(event) => setForm((current) => ({ ...current, customerDeclinePercent: event.target.value }))}
                  className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm tabular-nums text-ink"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Menyimpan...' : formExisting ? 'Perbarui rekap' : 'Simpan rekap'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <SectionHeading
          title="Detail Data Harian"
          description="Rekap snapshot PSB & Isolir per hari — otomatis diperbarui setelah input/impor"
          className="mb-5"
        />

        {loading && entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-muted">Memuat Detail Data Harian...</div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-sm font-medium text-ink">Belum ada rekap dalam 31 hari terakhir.</div>
            <p className="mt-1 text-sm text-ink-muted">
              {canManage ? 'Klik "Input rekap PSB & Isolir" atau impor workbook untuk mulai menampilkan Detail Data Harian.' : 'Data akan muncul setelah rekap harian dimasukkan.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-3 py-3">Tanggal</th>
                    <th className="px-3 py-3 text-right">Total Pelanggan</th>
                    <th className="px-3 py-3 text-right">Total List PSB</th>
                    <th className="px-3 py-3 text-right">Antrian Pasang</th>
                    <th className="px-3 py-3 text-right">Terpasang</th>
                    <th className="px-3 py-3 text-right">Isolir Lanjut</th>
                    <th className="px-3 py-3 text-right">Isolir Tidak Lanjut</th>
                    <th className="px-3 py-3 text-right">Total Isolir</th>
                    <th className="px-3 py-3 text-right">Dismantle Open</th>
                    <th className="px-3 py-3 text-right">Dismantle Close</th>
                    <th className="px-3 py-3 text-right">Penurunan</th>
                    <th className="px-3 py-3 text-right">Pelanggan Aktif</th>
                    {canManage && <th className="px-3 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...entries].reverse().map((entry) => (
                    <tr key={entry.reportDate} className="transition-colors hover:bg-surface-muted">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">{formatDateLabel(entry.reportDate)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{numberFormatter.format(entry.totalCustomers)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{numberFormatter.format(entry.totalPsbList)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{numberFormatter.format(entry.installationQueue)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{numberFormatter.format(entry.installedToday)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{numberFormatter.format(entry.isolationContinued)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{numberFormatter.format(entry.isolationNotContinued)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{numberFormatter.format(entry.isolationContinued + entry.isolationNotContinued)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{numberFormatter.format(entry.dismantleOpen)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{numberFormatter.format(entry.dismantleClosed)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{numberFormatter.format(entry.customerDeclinePercent)}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{numberFormatter.format(entry.activeCustomers)}</td>
                      {canManage && (
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setFormOpen(true)
                              void loadFormDate(entry.reportDate)
                            }}
                            className="rounded-md px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-ink-muted">
              Menampilkan {entries.length} data{latest ? ` · diperbarui ${formatUpdatedAt(latest.updatedAt)}` : ''}
            </div>
          </>
        )}
      </Card>
    </section>
  )
}
