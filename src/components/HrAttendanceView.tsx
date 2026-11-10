'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  Download,
  Fingerprint,
  Pencil,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Card } from '@/components/ui/Card'
import { Chip, type ChipTone } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { JAKARTA_OFFSET_MS } from '@/lib/jakarta-time'
import { HR_DIVISIONS } from '@/lib/hr-departments'

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
}

type DivisionRow = {
  department: string
  records: number
  employees: number
}

type MachineConfig = { ip: string; port: number }
type MachineUser = { uid?: number; userId: string | number; name: string; canDelete?: boolean }

type HrAttendanceViewProps = {
  userRole: string
  canManage: boolean
  canConfigureMachine: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

function currentMonthValue() {
  const nowWIB = new Date(Date.now() + JAKARTA_OFFSET_MS)
  return `${nowWIB.getUTCFullYear()}-${pad(nowWIB.getUTCMonth() + 1)}`
}

function monthToRange(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  const nowWIB = new Date(Date.now() + JAKARTA_OFFSET_MS)
  const year = match ? Number(match[1]) : nowWIB.getUTCFullYear()
  const month = match ? Number(match[2]) : nowWIB.getUTCMonth() + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  }
}

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

function formatTimeWIB(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const wib = new Date(date.getTime() + JAKARTA_OFFSET_MS)
  return `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`
}

function describeAttendance(row: AttendanceRow): { label: string; tone: ChipTone } {
  const hasIn = Boolean(row.checkIn)
  const hasOut = Boolean(row.checkOut)
  const status = (row.status || '').toUpperCase()
  if (!hasIn && !hasOut) return { label: 'Alfa', tone: 'danger' }
  if (status === 'LATE' || status === 'TERLAMBAT') return { label: 'Terlambat', tone: 'warning' }
  if (hasIn && hasOut) return { label: 'Hadir', tone: 'success' }
  return { label: 'Invalid', tone: 'warning' }
}

export function HrAttendanceView({ userRole, canManage, canConfigureMachine }: HrAttendanceViewProps) {
  const [month, setMonth] = useState(currentMonthValue)
  const range = useMemo(() => monthToRange(month), [month])
  const [items, setItems] = useState<AttendanceRow[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [summary, setSummary] = useState<Summary>({ totalRecords: 0, totalEmployees: 0 })
  const [divisions, setDivisions] = useState<DivisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null)

  const [query, setQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(null)

  const [machine, setMachine] = useState<MachineConfig>({ ip: '', port: 4370 })
  const [savedMachine, setSavedMachine] = useState<MachineConfig | null>(null)
  const [machineConnected, setMachineConnected] = useState<boolean | null>(null)
  const [machineNote, setMachineNote] = useState('')
  const [machineUsers, setMachineUsers] = useState<MachineUser[]>([])
  const [machineUsersQuery, setMachineUsersQuery] = useState('')
  const [machineUsersLoading, setMachineUsersLoading] = useState(false)
  const [savingMachine, setSavingMachine] = useState(false)
  const [showMachineSettings, setShowMachineSettings] = useState(false)
  const [editingMachineUser, setEditingMachineUser] = useState<MachineUser | null>(null)
  const [editingMachineUserName, setEditingMachineUserName] = useState('')
  const [savingMachineUser, setSavingMachineUser] = useState(false)
  const [deletingMachineUser, setDeletingMachineUser] = useState<MachineUser | null>(null)
  const [deleteMachineUserConfirmation, setDeleteMachineUserConfirmation] = useState('')
  const [deletingMachineUserBusy, setDeletingMachineUserBusy] = useState(false)
  const [deleteMachineUserError, setDeleteMachineUserError] = useState('')

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [exporting, setExporting] = useState(false)

  const machineConfigChanged =
    !savedMachine || machine.ip.trim() !== savedMachine.ip || machine.port !== savedMachine.port

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to })
      if (query.trim()) params.set('q', query.trim())
      if (departmentFilter) params.set('department', departmentFilter)

      const res = await fetch(`/api/hr/attendance?${params.toString()}`, { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as {
        items?: AttendanceRow[]
        employees?: EmployeeOption[]
        summary?: Summary
        divisions?: DivisionRow[]
        error?: string
      }
      if (!res.ok) {
        setFeedback({ tone: 'danger', message: data.error || 'Gagal memuat data absensi' })
        setItems([])
        return
      }
      setItems(data.items ?? [])
      setEmployees(data.employees ?? [])
      setSummary(data.summary ?? { totalRecords: 0, totalEmployees: 0 })
      setDivisions(data.divisions ?? [])
    } catch {
      setFeedback({ tone: 'danger', message: 'Gagal memuat data absensi' })
    } finally {
      setLoading(false)
    }
  }, [range, query, departmentFilter])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  const employeeGroups = useMemo(() => {
    const byEmployee = new Map<number, AttendanceRow[]>()
    for (const row of items) {
      const bucket = byEmployee.get(row.employeeId)
      if (bucket) bucket.push(row)
      else byEmployee.set(row.employeeId, [row])
    }
    const needle = query.trim().toLowerCase()
    return employees
      .filter((employee) => employee.isActive && Boolean(employee.fingerprintId))
      .filter((employee) => !departmentFilter || employee.department === departmentFilter)
      .filter((employee) => !needle || employee.name.toLowerCase().includes(needle))
      .map((employee) => {
        const records = (byEmployee.get(employee.id) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date))
        const presentDays = records.filter((row) => Boolean(row.checkIn)).length
        return { employee, records, presentDays }
      })
      .sort((a, b) => {
        const byDepartment = a.employee.department.localeCompare(b.employee.department)
        return byDepartment !== 0 ? byDepartment : a.employee.name.localeCompare(b.employee.name)
      })
  }, [items, employees, departmentFilter, query])

  const loadMachine = useCallback(async (updateConfig = true) => {
    setMachineUsersLoading(true)
    try {
      const res = await fetch('/api/hr/machine', { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as {
        config?: MachineConfig
        connected?: boolean
        error?: string
        users?: MachineUser[]
      }
      if (updateConfig && data.config) {
        setMachine(data.config)
        setSavedMachine(data.config)
      }
      setMachineUsers(Array.isArray(data.users) ? data.users : [])
      if (typeof data.connected === 'boolean') setMachineConnected(data.connected)
      setMachineNote(data.connected ? '' : data.error || 'Tidak dapat terhubung ke mesin')
    } catch {
      setMachineConnected(false)
      setMachineNote('Tidak dapat terhubung ke mesin')
      setMachineUsers([])
    } finally {
      setMachineUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canConfigureMachine) loadMachine()
  }, [canConfigureMachine, loadMachine])

  const handleSync = async () => {
    if (!canManage) return
    setSyncing(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/hr/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(canConfigureMachine ? { ip: machine.ip, port: machine.port } : {}),
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

  const handleExportExcel = async () => {
    if (exporting || employeeGroups.length === 0) return
    setExporting(true)
    setFeedback(null)
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new()

      for (const group of employeeGroups) {
        const { employee, records, presentDays } = group
        // Nama sheet dibatasi 31 karakter (batas Excel) & karakter ilegal dibersihkan.
        const sheetName = employee.name
          .replace(/[:\\/?*\[\]]/g, '_')
          .slice(0, 31)

        const rows: Array<Record<string, string | number>> = records.map((record) => {
          const status = describeAttendance(record)
          return {
            Tanggal: formatDateLabel(record.date),
            'Jam Masuk': formatTimeWIB(record.checkIn),
            'Jam Pulang': formatTimeWIB(record.checkOut),
            Status: status.label,
          }
        })

        // Baris ringkasan di akhir sheet.
        rows.push({
          Tanggal: 'Total Hadir',
          'Jam Masuk': `${presentDays} hari`,
          'Jam Pulang': '',
          Status: '',
        })

        const worksheet =
          rows.length > 0
            ? XLSX.utils.json_to_sheet(rows)
            : XLSX.utils.aoa_to_sheet([['Tidak ada data absensi']])
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || `Karyawan_${employee.id}`)
      }

      XLSX.writeFile(workbook, `absensi-${month}.xlsx`)
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Gagal export Excel',
      })
    } finally {
      setExporting(false)
    }
  }

  const handleSaveMachine = async () => {
    if (!canConfigureMachine) return
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

  const handleSaveMachineUserName = async () => {
    if (!canConfigureMachine || machineConfigChanged || !editingMachineUser?.uid) return
    setSavingMachineUser(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/hr/machine/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: editingMachineUser.uid, name: editingMachineUserName }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah nama user mesin')
      setFeedback({ tone: 'success', message: 'Nama user di mesin berhasil diperbarui.' })
      setEditingMachineUser(null)
      setEditingMachineUserName('')
      await loadMachine()
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Gagal mengubah nama user mesin',
      })
    } finally {
      setSavingMachineUser(false)
    }
  }

  const handleDeleteMachineUser = async () => {
    if (
      !canConfigureMachine ||
      machineConfigChanged ||
      !deletingMachineUser?.uid ||
      deleteMachineUserConfirmation !== String(deletingMachineUser.userId)
    ) {
      return
    }
    setDeletingMachineUserBusy(true)
    setDeleteMachineUserError('')
    setFeedback(null)
    try {
      const res = await fetch('/api/hr/machine/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: deletingMachineUser.uid,
          confirmationUserId: deleteMachineUserConfirmation,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus user mesin')
      setFeedback({ tone: 'success', message: 'User di mesin berhasil dihapus. Riwayat web tetap tersimpan.' })
      setDeletingMachineUser(null)
      setDeleteMachineUserConfirmation('')
      setDeleteMachineUserError('')
      await loadMachine()
    } catch (error) {
      setDeleteMachineUserError(
        error instanceof Error ? error.message : 'Gagal menghapus user mesin'
      )
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Gagal menghapus user mesin',
      })
    } finally {
      setDeletingMachineUserBusy(false)
    }
  }

  const filteredMachineUsers = machineUsers.filter((user) => {
    const needle = machineUsersQuery.trim().toLowerCase()
    if (!needle) return true
    return `${user.name} ${user.userId} ${user.uid ?? ''}`.toLowerCase().includes(needle)
  })

  const connectionTone = machineConnected === null ? 'neutral' : machineConnected ? 'success' : 'danger'
  const connectionLabel =
    machineConnected === null ? 'Memeriksa mesin...' : machineConnected ? 'Mesin terhubung' : 'Mesin tidak terhubung'

  const deleteMachineUserModal =
    deletingMachineUser && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4"
            onClick={() => {
              if (!deletingMachineUserBusy) {
                setDeletingMachineUser(null)
                setDeleteMachineUserConfirmation('')
                setDeleteMachineUserError('')
              }
            }}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-machine-user-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="delete-machine-user-title" className="text-base font-semibold text-slate-900 dark:text-white">
                    Hapus user dari mesin?
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {deletingMachineUser.name || 'Tanpa nama'} · ID fingerprint {deletingMachineUser.userId}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Tutup"
                  disabled={deletingMachineUserBusy}
                  onClick={() => {
                    setDeletingMachineUser(null)
                    setDeleteMachineUserConfirmation('')
                    setDeleteMachineUserError('')
                  }}
                  className="rounded-full bg-slate-100 p-1.5 text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                Hanya user perangkat yang dihapus. Riwayat web tetap tersimpan. Pastikan log absensi mesin sudah
                disinkronkan; user yang masih terkait karyawan aktif akan ditolak.
              </p>
              <label className="mt-4 block text-xs font-medium text-slate-700 dark:text-slate-200">
                Ketik ID fingerprint untuk konfirmasi
                <input
                  autoFocus
                  value={deleteMachineUserConfirmation}
                  onChange={(event) => setDeleteMachineUserConfirmation(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              {deleteMachineUserError && (
                <p className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                  {deleteMachineUserError}
                </p>
              )}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={deletingMachineUserBusy}
                  onClick={() => {
                    setDeletingMachineUser(null)
                    setDeleteMachineUserConfirmation('')
                    setDeleteMachineUserError('')
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteMachineUser}
                  disabled={
                    deletingMachineUserBusy ||
                    !deletingMachineUser.uid ||
                    deleteMachineUserConfirmation !== String(deletingMachineUser.userId)
                  }
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {deletingMachineUserBusy ? 'Menghapus...' : 'Hapus dari Mesin'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

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
            Data absensi yang ditarik dari mesin fingerprint (WIB). Hanya karyawan aktif dan terdaftar di mesin yang ditampilkan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canConfigureMachine && <Chip tone={connectionTone}>{connectionLabel}</Chip>}
          {canManage && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting || employeeGroups.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <Download className={clsx('h-4 w-4', exporting && 'animate-pulse')} />
                {exporting ? 'Menyiapkan...' : 'Export Excel'}
              </button>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-muted">Total Kehadiran</p>
          <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{summary.totalRecords}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-muted">Karyawan Tercatat</p>
          <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{summary.totalEmployees}</p>
        </Card>
      </div>

      {divisions.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-ink">Rekap per Divisi</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {divisions.map((division) => (
              <div key={division.department} className="rounded-xl border border-line bg-surface-muted px-3 py-2">
                <p className="truncate text-sm font-semibold text-ink">{division.department}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span>
                    Kehadiran: <span className="font-medium tabular-nums text-ink">{division.records}</span>
                  </span>
                  <span>
                    Karyawan: <span className="font-medium tabular-nums text-ink">{division.employees}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-ink-muted">
            Bulan
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value || currentMonthValue())}
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
          <label className="text-xs font-medium text-ink-muted">
            Divisi
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
            >
              <option value="">Semua divisi</option>
              {HR_DIVISIONS.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-ink-muted">Memuat data absensi...</div>
        ) : employeeGroups.length === 0 ? (
          <EmptyState
            icon={Fingerprint}
            title="Belum ada data karyawan"
            description="Tambahkan karyawan pada tab Daftar Karyawan, lalu tarik absensi dari mesin fingerprint."
          />
        ) : (
          <>
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">No</th>
                      <th className="px-4 py-3 font-semibold">Karyawan</th>
                      <th className="px-4 py-3 font-semibold">Divisi</th>
                      <th className="px-4 py-3 font-semibold">Hadir</th>
                      <th className="px-4 py-3 text-right font-semibold">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeGroups.map((group, index) => {
                      const expanded = expandedEmployeeId === group.employee.id
                      return (
                        <Fragment key={group.employee.id}>
                          <tr
                            className="cursor-pointer border-t border-line hover:bg-surface-muted"
                            onClick={() => setExpandedEmployeeId(expanded ? null : group.employee.id)}
                          >
                            <td className="px-4 py-3 tabular-nums text-ink-muted">{index + 1}</td>
                            <td className="px-4 py-3 font-medium text-ink">{group.employee.name}</td>
                            <td className="px-4 py-3 text-ink-muted">{group.employee.department || '-'}</td>
                            <td className="px-4 py-3 tabular-nums text-ink">{group.presentDays} hari</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                aria-label={expanded ? 'Tutup detail absensi' : 'Lihat detail absensi'}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setExpandedEmployeeId(expanded ? null : group.employee.id)
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-muted"
                              >
                                Detail
                                <ChevronDown
                                  className={clsx('h-4 w-4 transition-transform', expanded && 'rotate-180')}
                                />
                              </button>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="border-t border-line bg-surface-muted/60">
                              <td colSpan={5} className="px-4 py-3">
                                {group.records.length === 0 ? (
                                  <p className="text-xs text-ink-muted">Tidak ada absensi pada bulan ini.</p>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-surface-muted uppercase tracking-wide text-ink-muted">
                                        <tr>
                                          <th className="px-3 py-2 font-semibold">Tanggal</th>
                                          <th className="px-3 py-2 font-semibold">Jam Masuk</th>
                                          <th className="px-3 py-2 font-semibold">Jam Pulang</th>
                                          <th className="px-3 py-2 font-semibold">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {group.records.map((record) => {
                                          const status = describeAttendance(record)
                                          return (
                                            <tr key={record.id} className="border-t border-line">
                                              <td className="px-3 py-2 tabular-nums text-ink">
                                                {formatDateLabel(record.date)}
                                              </td>
                                              <td className="px-3 py-2 tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                                                {formatTimeWIB(record.checkIn)}
                                              </td>
                                              <td className="px-3 py-2 tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                                                {formatTimeWIB(record.checkOut)}
                                              </td>
                                              <td className="px-3 py-2">
                                                <Chip tone={status.tone}>{status.label}</Chip>
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="divide-y divide-line md:hidden">
              {employeeGroups.map((group) => {
                const expanded = expandedEmployeeId === group.employee.id
                return (
                  <div key={group.employee.id} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedEmployeeId(expanded ? null : group.employee.id)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{group.employee.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {group.employee.department || '-'} · {group.presentDays} hari hadir
                        </p>
                      </div>
                      <ChevronDown
                        className={clsx('h-4 w-4 text-ink-muted transition-transform', expanded && 'rotate-180')}
                      />
                    </button>
                    {expanded && (
                      <div className="mt-3 rounded-xl border border-line bg-surface-muted px-3 py-2">
                        {group.records.length === 0 ? (
                          <p className="text-xs text-ink-muted">Tidak ada absensi pada bulan ini.</p>
                        ) : (
                          <ul className="divide-y divide-line">
                            {group.records.map((record) => {
                              const status = describeAttendance(record)
                              return (
                                <li key={record.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                                  <div className="min-w-0">
                                    <p className="font-medium text-ink tabular-nums">{formatDateLabel(record.date)}</p>
                                    <p className="text-ink-muted tabular-nums">
                                      {formatTimeWIB(record.checkIn)}–{formatTimeWIB(record.checkOut)}
                                    </p>
                                  </div>
                                  <Chip tone={status.tone}>{status.label}</Chip>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>

      {canConfigureMachine && (
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
                    disabled={savingMachine || savingMachineUser || deletingMachineUserBusy || Boolean(deletingMachineUser)}
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
                    disabled={savingMachine || savingMachineUser || deletingMachineUserBusy || Boolean(deletingMachineUser)}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
                  />
                </label>
              </div>
              {machineNote && <p className="text-xs text-ink-muted">{machineNote}</p>}
              {machineConfigChanged && savedMachine && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Simpan konfigurasi mesin terlebih dahulu sebelum mengelola user.
                </p>
              )}
              <button
                type="button"
                onClick={handleSaveMachine}
                disabled={savingMachine || savingMachineUser || deletingMachineUserBusy || Boolean(deletingMachineUser)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Settings2 className="h-4 w-4" />
                {savingMachine ? 'Menyimpan...' : 'Simpan Konfigurasi'}
              </button>

              <div className="space-y-3 border-t border-line pt-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Pengguna di Mesin</h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      Edit hanya mengubah nama pada mesin. ID dikunci untuk menjaga mapping absensi; PIN tidak
                      ditampilkan. User dengan hak khusus dan user karyawan aktif tidak dapat dihapus dari web.
                      Penghapusan tidak menghapus riwayat web.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadMachine(false)}
                    disabled={machineUsersLoading || machineConfigChanged || savingMachine || savingMachineUser || deletingMachineUserBusy}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-muted disabled:opacity-60"
                  >
                    <RefreshCw className={clsx('h-3.5 w-3.5', machineUsersLoading && 'animate-spin')} />
                    Muat Ulang
                  </button>
                </div>

                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="search"
                    value={machineUsersQuery}
                    onChange={(event) => setMachineUsersQuery(event.target.value)}
                    placeholder="Cari nama, ID fingerprint, atau UID mesin"
                    className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink focus:outline-none"
                  />
                </label>

                {machineUsersLoading ? (
                  <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-ink-muted">
                    Memuat user mesin...
                  </p>
                ) : filteredMachineUsers.length === 0 ? (
                  <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-ink-muted">
                    {machineConnected ? 'User mesin tidak ditemukan.' : 'Hubungkan mesin untuk melihat user.'}
                  </p>
                ) : (
                  <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                    {filteredMachineUsers.map((user) => (
                      <div
                        key={`${user.uid ?? 'unknown'}-${user.userId}`}
                        className="rounded-xl border border-line bg-surface p-3"
                      >
                        {editingMachineUser?.uid === user.uid ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                            <label className="text-xs font-medium text-ink-muted">
                              Nama di mesin (maks. 24 karakter ASCII)
                              <input
                                autoFocus
                                maxLength={24}
                                value={editingMachineUserName}
                                onChange={(event) => setEditingMachineUserName(event.target.value)}
                                className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm text-ink focus:outline-none"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={handleSaveMachineUserName}
                              disabled={savingMachineUser || machineConfigChanged || !editingMachineUserName.trim()}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {savingMachineUser ? 'Menyimpan...' : 'Simpan Nama'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMachineUser(null)
                                setEditingMachineUserName('')
                              }}
                              disabled={savingMachineUser}
                              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink">{user.name || 'Tanpa nama'}</p>
                              <p className="mt-0.5 text-xs text-ink-muted">
                                ID fingerprint: {user.userId} · UID mesin: {user.uid ?? '-'}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                disabled={!user.uid || user.uid > 3000 || machineConfigChanged || machineUsersLoading}
                                onClick={() => {
                                  setEditingMachineUser(user)
                                  setEditingMachineUserName(user.name)
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit Nama
                              </button>
                              <button
                                type="button"
                                disabled={
                                  !user.uid ||
                                  user.uid > 3000 ||
                                  user.canDelete !== true ||
                                  machineConfigChanged ||
                                  machineUsersLoading
                                }
                                title={
                                  user.canDelete === false
                                    ? 'User dengan hak khusus pada mesin tidak dapat dihapus dari web.'
                                    : undefined
                                }
                                onClick={() => {
                                  setDeletingMachineUser(user)
                                  setDeleteMachineUserConfirmation('')
                                  setDeleteMachineUserError('')
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-2.5 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Hapus
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {(userRole || '').toUpperCase() === 'HR' && (
        <p className="text-xs text-ink-muted">
          Sumber absensi tunggal: mesin fingerprint (FINGERPRINT_MACHINE).
        </p>
      )}

      {importModal}
      {deleteMachineUserModal}
    </div>
  )
}
