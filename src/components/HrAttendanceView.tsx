'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  Fingerprint,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Upload,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { JAKARTA_OFFSET_MS } from '@/lib/jakarta-time'

type AttendanceRow = {
  id: number
  date: string
  employeeId: number
  employeeName: string
  department: string
  checkIn: string | null
  checkOut: string | null
  status: string
  source: string
  overtimeMinutes: number
}

type EmployeeOption = {
  id: number
  name: string
  department: string
  fingerprintId: string | null
  isActive: boolean
}

type Summary = {
  totalRecords: number
  totalEmployees: number
  totalOvertimeMinutes: number
}

type MachineConfig = { ip: string; port: number }

type HrAttendanceViewProps = {
  userRole: string
  canManage: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

function currentMonthRange() {
  const nowWIB = new Date(Date.now() + JAKARTA_OFFSET_MS)
  const year = nowWIB.getUTCFullYear()
  const month = nowWIB.getUTCMonth() + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  }
}

function formatDateLabel(value: string) {
  const iso = new Date(value).toISOString().split('T')[0]
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function formatTimeWIB(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const wib = new Date(date.getTime() + JAKARTA_OFFSET_MS)
  return `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`
}

function formatOvertime(minutes: number) {
  if (!minutes || minutes <= 0) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours <= 0) return `${mins} mnt`
  return mins > 0 ? `${hours} j ${mins} mnt` : `${hours} j`
}

export function HrAttendanceView({ userRole, canManage }: HrAttendanceViewProps) {
  const initialRange = useMemo(currentMonthRange, [])
  const [items, setItems] = useState<AttendanceRow[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [summary, setSummary] = useState<Summary>({ totalRecords: 0, totalEmployees: 0, totalOvertimeMinutes: 0 })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null)

  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [query, setQuery] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [mobileExpandedId, setMobileExpandedId] = useState<number | null>(null)

  const [machine, setMachine] = useState<MachineConfig>({ ip: '', port: 4370 })
  const [machineConnected, setMachineConnected] = useState<boolean | null>(null)
  const [machineNote, setMachineNote] = useState('')
  const [savingMachine, setSavingMachine] = useState(false)
  const [showMachineSettings, setShowMachineSettings] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (query.trim()) params.set('q', query.trim())
      if (employeeId) params.set('employeeId', employeeId)

      const res = await fetch(`/api/hr/attendance?${params.toString()}`, { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as {
        items?: AttendanceRow[]
        employees?: EmployeeOption[]
        summary?: Summary
        error?: string
      }
      if (!res.ok) {
        setFeedback({ tone: 'danger', message: data.error || 'Gagal memuat data absensi' })
        setItems([])
        return
      }
      setItems(data.items ?? [])
      setEmployees(data.employees ?? [])
      setSummary(data.summary ?? { totalRecords: 0, totalEmployees: 0, totalOvertimeMinutes: 0 })
    } catch {
      setFeedback({ tone: 'danger', message: 'Gagal memuat data absensi' })
    } finally {
      setLoading(false)
    }
  }, [from, to, query, employeeId])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  const loadMachine = useCallback(async () => {
    try {
      const res = await fetch('/api/hr/machine', { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as {
        config?: MachineConfig
        connected?: boolean
        error?: string
      }
      if (data.config) setMachine(data.config)
      if (typeof data.connected === 'boolean') setMachineConnected(data.connected)
      setMachineNote(data.connected ? '' : data.error || 'Tidak dapat terhubung ke mesin')
    } catch {
      setMachineConnected(false)
      setMachineNote('Tidak dapat terhubung ke mesin')
    }
  }, [])

  useEffect(() => {
    loadMachine()
  }, [loadMachine])

  const handleSync = async () => {
    if (!canManage) return
    setSyncing(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/hr/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: machine.ip, port: machine.port }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        result?: { createdCount: number; updatedCount: number; skippedCount: number; createdEmployees: number }
        error?: string
      }
      if (!res.ok) {
        setFeedback({ tone: 'danger', message: data.error || 'Gagal sinkronisasi dari mesin' })
        return
      }
      const result = data.result
      setFeedback({
        tone: 'success',
        message: result
          ? `Sinkronisasi selesai. Dibuat: ${result.createdCount}, diperbarui: ${result.updatedCount}, dilewati: ${result.skippedCount}.`
          : 'Sinkronisasi selesai. Tidak ada log baru.',
      })
      await loadAttendance()
    } catch {
      setFeedback({ tone: 'danger', message: 'Gagal sinkronisasi dari mesin' })
    } finally {
      setSyncing(false)
    }
  }

  const handleImport = async () => {
    if (!canManage) return
    setImportError('')
    let parsed: unknown
    try {
      parsed = JSON.parse(importText)
    } catch {
      setImportError('Format JSON tidak valid.')
      return
    }
    const logs = Array.isArray(parsed) ? parsed : (parsed as { data?: unknown }).data
    if (!Array.isArray(logs) || logs.length === 0) {
      setImportError('Tidak ada log yang bisa diimpor. Tempelkan array log dari mesin.')
      return
    }

    setImporting(true)
    try {
      const res = await fetch('/api/hr/attendance/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        result?: { createdCount: number; updatedCount: number; skippedCount: number; createdEmployees: number }
        reason?: string
        error?: string
      }
      if (!res.ok) {
        setImportError(data.error || 'Gagal mengimpor log')
        return
      }
      const result = data.result
      setFeedback({
        tone: 'success',
        message: result
          ? `Impor selesai. Dibuat: ${result.createdCount}, diperbarui: ${result.updatedCount}, dilewati: ${result.skippedCount}.`
          : data.reason || 'Tidak ada log yang diimpor.',
      })
      setImportOpen(false)
      setImportText('')
      await loadAttendance()
    } catch {
      setImportError('Gagal mengimpor log')
    } finally {
      setImporting(false)
    }
  }

  const handleSaveMachine = async () => {
    if (!canManage) return
    setSavingMachine(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/hr/machine', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: machine.ip, port: machine.port }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFeedback({ tone: 'danger', message: data.error || 'Gagal menyimpan konfigurasi mesin' })
        return
      }
      setFeedback({ tone: 'success', message: 'Konfigurasi mesin tersimpan.' })
      await loadMachine()
    } catch {
      setFeedback({ tone: 'danger', message: 'Gagal menyimpan konfigurasi mesin' })
    } finally {
      setSavingMachine(false)
    }
  }

  const connectionTone = machineConnected === null ? 'neutral' : machineConnected ? 'success' : 'danger'
  const connectionLabel =
    machineConnected === null ? 'Memeriksa mesin...' : machineConnected ? 'Mesin terhubung' : 'Mesin tidak terhubung'

  const importModal =
    importOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"
            onClick={() => setImportOpen(false)}
            role="presentation"
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-label="Impor log mentah"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Impor Log Mentah</h3>
                <button
                  type="button"
                  aria-label="Tutup"
                  onClick={() => setImportOpen(false)}
                  className="rounded-full bg-slate-100 p-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Tempelkan array log dari mesin fingerprint (format JSON). Mapping karyawan dilakukan berdasarkan ID
                fingerprint yang sudah tersinkron.
              </p>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                rows={8}
                placeholder='[{"deviceUserId":"1","recordTime":"2026-01-01 08:00:00","state":0}]'
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              {importError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{importError}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {importing ? 'Mengimpor...' : 'Impor'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-ink sm:text-2xl">
            <Fingerprint className="h-6 w-6 text-brand" />
            Absensi Karyawan
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Data absensi yang ditarik dari mesin fingerprint, dihitung otomatis termasuk lembur (WIB).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={connectionTone}>{connectionLabel}</Chip>
          {canManage && (
            <>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                <RefreshCw className={clsx('h-4 w-4', syncing && 'animate-spin')} />
                {syncing ? 'Menyinkron...' : 'Tarik dari Mesin'}
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="hidden items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 md:inline-flex dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Upload className="h-4 w-4" />
                Impor Log Mentah
              </button>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={clsx(
            'rounded-xl border px-4 py-3 text-sm',
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
          )}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-muted">Total Kehadiran</p>
          <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{summary.totalRecords}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-muted">Karyawan Tercatat</p>
          <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{summary.totalEmployees}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-muted">Total Lembur</p>
          <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{formatOvertime(summary.totalOvertimeMinutes)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <label className="text-xs font-medium text-ink-muted">
            Dari tanggal
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-ink-muted">
            Sampai tanggal
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-ink-muted">
            Cari karyawan
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nama karyawan"
                className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink focus:outline-none"
              />
            </div>
          </label>
          <label className="hidden text-xs font-medium text-ink-muted md:block">
            Karyawan
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
            >
              <option value="">Semua karyawan</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-ink-muted">Memuat data absensi...</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Fingerprint}
            title="Belum ada data absensi"
            description="Tarik data dari mesin fingerprint untuk periode ini, atau ubah rentang tanggal."
          />
        ) : (
          <>
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Tanggal</th>
                      <th className="px-4 py-3 font-semibold">Karyawan</th>
                      <th className="px-4 py-3 font-semibold">Departemen</th>
                      <th className="px-4 py-3 font-semibold">Masuk</th>
                      <th className="px-4 py-3 font-semibold">Keluar</th>
                      <th className="px-4 py-3 font-semibold">Lembur</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-t border-line">
                        <td className="px-4 py-3 tabular-nums text-ink">{formatDateLabel(row.date)}</td>
                        <td className="px-4 py-3 font-medium text-ink">{row.employeeName}</td>
                        <td className="px-4 py-3 text-ink-muted">{row.department || '-'}</td>
                        <td className="px-4 py-3 tabular-nums text-ink">{formatTimeWIB(row.checkIn)}</td>
                        <td className="px-4 py-3 tabular-nums text-ink">{formatTimeWIB(row.checkOut)}</td>
                        <td className="px-4 py-3 tabular-nums text-ink">{formatOvertime(row.overtimeMinutes)}</td>
                        <td className="px-4 py-3">
                          <Chip tone={row.status === 'PRESENT' ? 'success' : 'neutral'}>{row.status}</Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="divide-y divide-line md:hidden">
              {items.map((row) => {
                const expanded = mobileExpandedId === row.id
                return (
                  <div key={row.id} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setMobileExpandedId(expanded ? null : row.id)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{row.employeeName}</p>
                        <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                          {formatDateLabel(row.date)} · {formatTimeWIB(row.checkIn)}–{formatTimeWIB(row.checkOut)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip tone={row.overtimeMinutes > 0 ? 'warning' : 'neutral'}>
                          {formatOvertime(row.overtimeMinutes)}
                        </Chip>
                        <ChevronDown
                          className={clsx('h-4 w-4 text-ink-muted transition-transform', expanded && 'rotate-180')}
                        />
                      </div>
                    </button>
                    {expanded && (
                      <dl className="mt-3 space-y-1.5 rounded-xl border border-line bg-surface-muted px-3 py-2 text-xs">
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">Departemen</dt>
                          <dd className="text-right font-medium text-ink">{row.department || '-'}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">Jam Masuk</dt>
                          <dd className="text-right font-medium text-ink tabular-nums">{formatTimeWIB(row.checkIn)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">Jam Keluar</dt>
                          <dd className="text-right font-medium text-ink tabular-nums">{formatTimeWIB(row.checkOut)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">Lembur</dt>
                          <dd className="text-right font-medium text-ink">{formatOvertime(row.overtimeMinutes)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">Status</dt>
                          <dd className="text-right font-medium text-ink">{row.status}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">Sumber</dt>
                          <dd className="text-right font-medium text-ink">{row.source}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>

      {canManage && (
        <Card className="p-4">
          <button
            type="button"
            onClick={() => setShowMachineSettings((value) => !value)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Server className="h-4 w-4 text-ink-muted" />
              Konfigurasi Mesin Fingerprint
            </span>
            <ChevronDown
              className={clsx('h-4 w-4 text-ink-muted transition-transform', showMachineSettings && 'rotate-180')}
            />
          </button>
          {showMachineSettings && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-ink-muted sm:col-span-2">
                  IP Mesin
                  <input
                    type="text"
                    value={machine.ip}
                    onChange={(event) => setMachine((prev) => ({ ...prev, ip: event.target.value }))}
                    placeholder="103.162.16.14"
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
                  />
                </label>
                <label className="text-xs font-medium text-ink-muted">
                  Port
                  <input
                    type="number"
                    value={machine.port}
                    onChange={(event) =>
                      setMachine((prev) => ({ ...prev, port: Number(event.target.value) || prev.port }))
                    }
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
                  />
                </label>
              </div>
              {machineNote && <p className="text-xs text-ink-muted">{machineNote}</p>}
              <button
                type="button"
                onClick={handleSaveMachine}
                disabled={savingMachine}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Settings2 className="h-4 w-4" />
                {savingMachine ? 'Menyimpan...' : 'Simpan Konfigurasi'}
              </button>
            </div>
          )}
        </Card>
      )}

      {(userRole || '').toUpperCase() === 'HR' && (
        <p className="text-xs text-ink-muted">
          Sumber absensi tunggal: mesin fingerprint (FINGERPRINT_MACHINE). Perhitungan lembur dilakukan di server.
        </p>
      )}

      {importModal}
    </div>
  )
}
