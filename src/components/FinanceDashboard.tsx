'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import Image from 'next/image'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, FileSpreadsheet, RefreshCw, Save, Upload, Users, Wrench, ListTodo, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { chartCursorFill, chartTooltipStyle } from '@/components/ui/chart'

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

function formatDateShort(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
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

function getChangePercent(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    if (current > 0) return 100
    if (current < 0) return -100
    return 0
  }
  return ((current - previous) / Math.abs(previous)) * 100
}

function formatChangePercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1).replace('.', ',')}%`
}

function previousMonthLabel(): string {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return prev.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  return (
    <div className="flex h-9 items-end gap-1">
      {values.map((value, index) => {
        const height = Math.max(4, Math.round(((value - min) / range) * 36))
        return (
          <div
            key={index}
            className="w-1.5 rounded-sm"
            style={{ height: `${height}px`, backgroundColor: color, opacity: 0.55 + (index / values.length) * 0.45 }}
          />
        )
      })}
    </div>
  )
}

function BillingStatCard({
  label,
  value,
  changePercent,
  sparkValues,
  icon,
  iconBg,
  sparkColor,
}: {
  label: string
  value: number
  changePercent: number
  sparkValues: number[]
  icon: ReactNode
  iconBg: string
  sparkColor: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-ink">{numberFormatter.format(value)}</p>
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`inline-flex items-center font-semibold ${changePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {changePercent >= 0 ? '↑' : '↓'} {formatChangePercent(changePercent)}
          </span>
          <span className="text-ink-muted">vs {previousMonthLabel()}</span>
        </div>
      </div>
      <div className="shrink-0">
        <Sparkline values={sparkValues} color={sparkColor} />
      </div>
    </div>
  )
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '')
          if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
          return value
        })
        .join(','),
    )
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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
  const chartRows = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        label: formatDateShort(entry.reportDate),
        isolationTotal: entry.isolationContinued + entry.isolationNotContinued,
      })),
    [entries],
  )

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
      setMessage(`Rekap ${formatDateLabel(form.reportDate)} berhasil ${formExisting ? 'diperbarui' : 'disimpan'}. Tabel & grafik otomatis diperbarui.`)
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

  const handleExportCsv = () => {
    const headers = [
      'Tanggal',
      'Total Pelanggan',
      'Total List PSB',
      'Antrian Pasang',
      'Terpasang',
      'Isolir Lanjut',
      'Isolir Tidak Lanjut',
      'Total Isolir',
      'Dismantle Open',
      'Dismantle Close',
      'Penurunan (%)',
      'Pelanggan Aktif',
    ]
    const rows = [...entries].reverse().map((entry) => [
      formatDateLabel(entry.reportDate),
      String(entry.totalCustomers),
      String(entry.totalPsbList),
      String(entry.installationQueue),
      String(entry.installedToday),
      String(entry.isolationContinued),
      String(entry.isolationNotContinued),
      String(entry.isolationContinued + entry.isolationNotContinued),
      String(entry.dismantleOpen),
      String(entry.dismantleClosed),
      String(entry.customerDeclinePercent),
      String(entry.activeCustomers),
    ])
    downloadCsv(`detail-data-harian-${jakartaTodayKey()}.csv`, [headers, ...rows])
    setMessage('Detail Data Harian berhasil diekspor ke Excel (CSV).')
  }

  const totalSolir = latest ? latest.isolationContinued + latest.isolationNotContinued : 0
  const totalDismantle = latest ? latest.dismantleOpen : 0

  const baseline = entries.at(0) ?? null
  const sparkWindow = entries.slice(-7)

  const psbValue = latest?.totalPsbList ?? 0
  const psbChange = getChangePercent(psbValue, baseline?.totalPsbList ?? 0)
  const psbSpark = sparkWindow.map((entry) => entry.totalPsbList)

  const solirValue = totalSolir
  const solirBaseline = baseline ? baseline.isolationContinued + baseline.isolationNotContinued : 0
  const solirChange = getChangePercent(solirValue, solirBaseline)
  const solirSpark = sparkWindow.map((entry) => entry.isolationContinued + entry.isolationNotContinued)

  const dismantleValue = totalDismantle
  const dismantleChange = getChangePercent(dismantleValue, baseline?.dismantleOpen ?? 0)
  const dismantleSpark = sparkWindow.map((entry) => entry.dismantleOpen)

  const activeValue = latest?.activeCustomers ?? 0
  const activeChange = getChangePercent(activeValue, baseline?.activeCustomers ?? 0)
  const activeSpark = sparkWindow.map((entry) => entry.activeCustomers)

  return (
    <section className="space-y-4 pb-10">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b2b5e] via-[#0f3a7a] to-[#1e5fbf] px-5 py-5 text-white shadow-md sm:px-6">
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-20">
          <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="xMaxYMid slice" fill="none">
            <g fill="rgba(255,255,255,0.35)">
              <rect x="10" y="120" width="14" height="60" rx="2" />
              <rect x="30" y="100" width="14" height="80" rx="2" />
              <rect x="50" y="110" width="14" height="70" rx="2" />
              <rect x="70" y="90" width="14" height="90" rx="2" />
              <rect x="90" y="105" width="14" height="75" rx="2" />
              <rect x="110" y="80" width="14" height="100" rx="2" />
              <rect x="130" y="95" width="14" height="85" rx="2" />
              <rect x="150" y="70" width="14" height="110" rx="2" />
              <rect x="170" y="85" width="14" height="95" rx="2" />
              <rect x="190" y="60" width="14" height="120" rx="2" />
              <rect x="210" y="75" width="14" height="105" rx="2" />
              <rect x="230" y="55" width="14" height="125" rx="2" />
              <rect x="250" y="70" width="14" height="110" rx="2" />
              <rect x="270" y="90" width="14" height="90" rx="2" />
              <rect x="290" y="100" width="14" height="80" rx="2" />
              <rect x="310" y="80" width="14" height="100" rx="2" />
              <rect x="330" y="95" width="14" height="85" rx="2" />
              <rect x="350" y="110" width="14" height="70" rx="2" />
              <rect x="370" y="100" width="14" height="80" rx="2" />
            </g>
            <g stroke="rgba(255,255,255,0.4)" strokeWidth="2">
              <line x1="195" y1="20" x2="195" y2="200" />
              <line x1="195" y1="40" x2="165" y2="10" />
              <line x1="195" y1="40" x2="225" y2="10" />
              <line x1="195" y1="70" x2="150" y2="30" />
              <line x1="195" y1="70" x2="240" y2="30" />
            </g>
          </svg>
        </div>
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Dashboard Admin Billing</h1>
            <p className="mt-0.5 text-sm text-white/80">Rekapitulasi data pelanggan baru (PSB) dan pengaduan (Solir)</p>
          </div>
          <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
            <Image src="/logo-white.svg" alt="Perkasa Networks" width={32} height={32} className="h-8 w-auto" />
            <div className="text-right">
              <div className="text-sm font-bold leading-tight">PERKASA</div>
              <div className="text-[11px] leading-tight text-white/70">NETWORKS</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void loadEntries()}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Perbarui
        </button>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        )}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BillingStatCard
          label="Total Pelanggan PSB"
          value={psbValue}
          changePercent={psbChange}
          sparkValues={psbSpark}
          icon={<Users className="h-6 w-6" />}
          iconBg="bg-blue-500"
          sparkColor="#3b82f6"
        />
        <BillingStatCard
          label="Total Solir"
          value={solirValue}
          changePercent={solirChange}
          sparkValues={solirSpark}
          icon={<Wrench className="h-6 w-6" />}
          iconBg="bg-emerald-500"
          sparkColor="#10b981"
        />
        <BillingStatCard
          label="Total Dismantle"
          value={dismantleValue}
          changePercent={dismantleChange}
          sparkValues={dismantleSpark}
          icon={<ListTodo className="h-6 w-6" />}
          iconBg="bg-violet-500"
          sparkColor="#8b5cf6"
        />
        <BillingStatCard
          label="Total Pelanggan Aktif"
          value={activeValue}
          changePercent={activeChange}
          sparkValues={activeSpark}
          icon={<TrendingUp className="h-6 w-6" />}
          iconBg="bg-amber-500"
          sparkColor="#f59e0b"
        />
      </div>

      {canManage && formOpen && (
        <Card className="p-4 sm:p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Input rekap PSB &amp; Isolir</h3>
                <p className="text-sm text-ink-muted">Menyimpan kembali tanggal yang sama akan memperbarui rekap. Tabel & grafik otomatis diperbarui.</p>
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

      {entries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-ink">Total Pelanggan Harian RadBoox 24, 25 &amp; 26</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" interval={Math.max(0, Math.floor(chartRows.length / 8) - 1)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" width={50} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} formatter={(value) => numberFormatter.format(Number(value ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-muted)' }} />
                  <Line type="monotone" dataKey="totalCustomers" name="Total Pelanggan" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#fff' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-ink">Pelanggan Aktif Harian RadBoox 24, 25 &amp; 26</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" interval={Math.max(0, Math.floor(chartRows.length / 8) - 1)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" width={50} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} formatter={(value) => numberFormatter.format(Number(value ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-muted)' }} />
                  <Line type="monotone" dataKey="activeCustomers" name="Pelanggan Aktif" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#fff' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-ink">Data Isolir Harian</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" interval={Math.max(0, Math.floor(chartRows.length / 8) - 1)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" width={50} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} formatter={(value) => numberFormatter.format(Number(value ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-muted)' }} />
                  <Line type="monotone" dataKey="isolationContinued" name="Masih Dilanjutkan" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#fff' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="isolationNotContinued" name="Tidak Dilanjutkan" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#fff' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-ink">Dismantle Harian</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" interval={Math.max(0, Math.floor(chartRows.length / 8) - 1)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" width={50} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={chartCursorFill} labelStyle={{ color: 'var(--ink)' }} itemStyle={{ color: 'var(--ink)' }} formatter={(value) => numberFormatter.format(Number(value ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-muted)' }} />
                  <Line type="monotone" dataKey="dismantleClosed" name="Close" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#fff' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="dismantleOpen" name="Open" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#fff' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
