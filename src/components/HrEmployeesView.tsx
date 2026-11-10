'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Pencil, Power, Search, Trash2, UserPlus, Users, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { JAKARTA_OFFSET_MS } from '@/lib/jakarta-time'
import {
  DEFAULT_HR_DIVISION,
  DEFAULT_HR_POSITION,
  HR_DIVISIONS,
  HR_EMPLOYMENT_STATUSES,
  HR_POSITIONS,
  getHrSubdivisions,
  isPositionWithoutSubdivision,
  type HrDivision,
} from '@/lib/hr-departments'

type EmployeeRow = {
  id: number
  name: string
  department: string
  position: string
  subdivision: string | null
  employmentStatus: string
  joinDate: string
  fingerprintId: string | null
  isActive: boolean
  attendanceCount: number
}

type FormState = {
  id: number | null
  name: string
  department: string
  position: string
  subdivision: string
  employmentStatus: string
  joinDate: string
  fingerprintId: string
  isActive: boolean
}

type HrEmployeesViewProps = {
  canManage: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

function emptyForm(): FormState {
  return {
    id: null,
    name: '',
    department: DEFAULT_HR_DIVISION,
    position: DEFAULT_HR_POSITION,
    subdivision: getHrSubdivisions(DEFAULT_HR_DIVISION)[0] ?? '',
    employmentStatus: 'Karyawan',
    joinDate: '',
    fingerprintId: '',
    isActive: true,
  }
}

function formatDateLabel(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

function toDateInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const wib = new Date(date.getTime() + JAKARTA_OFFSET_MS)
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}`
}

export function HrEmployeesView({ canManage }: HrEmployeesViewProps) {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null)
  const [mobileExpandedId, setMobileExpandedId] = useState<number | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (department) params.set('department', department)
      if (showInactive) params.set('inactive', '1')

      const res = await fetch(`/api/hr/employees?${params.toString()}`, { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as {
        employees?: EmployeeRow[]
        error?: string
      }
      if (!res.ok) {
        setFeedback({ tone: 'danger', message: data.error || 'Gagal memuat daftar karyawan' })
        setEmployees([])
        return
      }
      setEmployees(data.employees ?? [])
    } catch {
      setFeedback({ tone: 'danger', message: 'Gagal memuat daftar karyawan' })
    } finally {
      setLoading(false)
    }
  }, [query, department, showInactive])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const divisionOptions = useMemo(() => {
    const options: string[] = [...HR_DIVISIONS]
    if (form.department && !options.includes(form.department)) {
      options.unshift(form.department)
    }
    return options
  }, [form.department])

  const subdivisionOptions = useMemo(() => {
    const options: string[] = [...getHrSubdivisions(form.department)]
    if (form.subdivision && !options.includes(form.subdivision)) {
      options.unshift(form.subdivision)
    }
    return options
  }, [form.department, form.subdivision])

  const positionOptions = useMemo(() => {
    const options: string[] = [...HR_POSITIONS]
    if (form.position && !options.includes(form.position)) {
      options.unshift(form.position)
    }
    return options
  }, [form.position])

  const openCreate = () => {
    setForm(emptyForm())
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (row: EmployeeRow) => {
    setForm({
      id: row.id,
      name: row.name,
      department: row.department || DEFAULT_HR_DIVISION,
      position: row.position || DEFAULT_HR_POSITION,
      subdivision: row.subdivision || getHrSubdivisions(row.department || DEFAULT_HR_DIVISION)[0] || '',
      employmentStatus: row.employmentStatus || 'Karyawan',
      joinDate: toDateInput(row.joinDate),
      fingerprintId: row.fingerprintId ?? '',
      isActive: row.isActive,
    })
    setFormError('')
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!canManage) return
    const name = form.name.trim()
    if (!name) {
      setFormError('Nama karyawan wajib diisi.')
      return
    }

    const payload: Record<string, unknown> = {
      name,
      department: form.department,
      position: form.position.trim() || DEFAULT_HR_POSITION,
      subdivision: form.subdivision,
      employmentStatus: form.employmentStatus,
      fingerprintId: form.fingerprintId.trim(),
      isActive: form.isActive,
    }
    if (form.joinDate) payload.joinDate = form.joinDate
    if (form.id !== null) payload.id = form.id

    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/hr/employees', {
        method: form.id !== null ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFormError(data.error || 'Gagal menyimpan karyawan.')
        return
      }
      setFeedback({ tone: 'success', message: form.id !== null ? 'Data karyawan diperbarui.' : 'Karyawan baru ditambahkan.' })
      setFormOpen(false)
      await loadEmployees()
    } catch {
      setFormError('Gagal menyimpan karyawan.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (row: EmployeeRow) => {
    if (!canManage) return
    try {
      const res = await fetch('/api/hr/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, isActive: !row.isActive }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFeedback({ tone: 'danger', message: data.error || 'Gagal mengubah status karyawan' })
        return
      }
      setFeedback({ tone: 'success', message: row.isActive ? 'Karyawan dinonaktifkan.' : 'Karyawan diaktifkan kembali.' })
      await loadEmployees()
    } catch {
      setFeedback({ tone: 'danger', message: 'Gagal mengubah status karyawan' })
    }
  }

  const handleDelete = async (row: EmployeeRow) => {
    if (!canManage) return
    if (!window.confirm(`Hapus karyawan "${row.name}"? Tindakan ini permanen.`)) return
    setDeletingId(row.id)
    try {
      const res = await fetch(`/api/hr/employees?id=${row.id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFeedback({ tone: 'danger', message: data.error || 'Gagal menghapus karyawan' })
        return
      }
      setFeedback({ tone: 'success', message: 'Karyawan dihapus.' })
      await loadEmployees()
    } catch {
      setFeedback({ tone: 'danger', message: 'Gagal menghapus karyawan' })
    } finally {
      setDeletingId(null)
    }
  }

  const formModal =
    formOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"
            onClick={() => setFormOpen(false)}
            role="presentation"
          >
            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-label={form.id !== null ? 'Ubah karyawan' : 'Tambah karyawan'}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {form.id !== null ? 'Ubah Karyawan' : 'Tambah Karyawan'}
                </h3>
                <button
                  type="button"
                  aria-label="Tutup"
                  onClick={() => setFormOpen(false)}
                  className="rounded-full bg-slate-100 p-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600 sm:col-span-2 dark:text-slate-300">
                  Nama Karyawan
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Nama lengkap"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
                <p className="sm:col-span-2 -mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Akun web ber-role Marketing dikenali otomatis jika namanya sama dan unik dengan nama karyawan.
                </p>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Jabatan
                  <select
                    value={form.position}
                    onChange={(event) =>
                      setForm((prev) => {
                        const nextPosition = event.target.value
                        // Jabatan General Manager & Manager tidak memiliki sub divisi.
                        return isPositionWithoutSubdivision(nextPosition)
                          ? { ...prev, position: nextPosition, subdivision: '' }
                          : { ...prev, position: nextPosition }
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {positionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Sub Divisi
                  <select
                    value={form.subdivision}
                    onChange={(event) => setForm((prev) => ({ ...prev, subdivision: event.target.value }))}
                    disabled={isPositionWithoutSubdivision(form.position)}
                    className={clsx(
                      'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
                      isPositionWithoutSubdivision(form.position) && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    {subdivisionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {isPositionWithoutSubdivision(form.position) && (
                    <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                      Jabatan {form.position} tidak memiliki sub divisi.
                    </span>
                  )}
                </label>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Divisi
                  <select
                    value={form.department}
                    onChange={(event) =>
                      setForm((prev) => {
                        const nextDivision = event.target.value as HrDivision
                        return {
                          ...prev,
                          department: nextDivision,
                          subdivision: getHrSubdivisions(nextDivision)[0] ?? '',
                        }
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {divisionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Status Kepegawaian
                  <select
                    value={form.employmentStatus}
                    onChange={(event) => setForm((prev) => ({ ...prev, employmentStatus: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {HR_EMPLOYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Tanggal Masuk
                  <input
                    type="date"
                    value={form.joinDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, joinDate: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  ID Fingerprint
                  <input
                    type="text"
                    value={form.fingerprintId}
                    onChange={(event) => setForm((prev) => ({ ...prev, fingerprintId: event.target.value }))}
                    placeholder="Opsional"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Karyawan aktif
                </label>
              </div>

              {formError && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{formError}</p>}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
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
            <Users className="h-6 w-6 text-brand" />
            Daftar Karyawan
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Kelola data karyawan beserta divisinya agar absensi dapat ditinjau per divisi.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Tambah Karyawan
          </button>
        )}
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

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
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
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
            >
              <option value="">Semua divisi</option>
              {HR_DIVISIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end text-xs font-medium text-ink-muted">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            Tampilkan nonaktif
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-ink-muted">Memuat daftar karyawan...</div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada karyawan"
            description={
              canManage
                ? 'Tambahkan karyawan secara manual, atau tarik data dari mesin fingerprint agar terbuat otomatis.'
                : 'Belum ada data karyawan untuk filter ini.'
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">No</th>
                      <th className="px-4 py-3 font-semibold">Nama</th>
                      <th className="px-4 py-3 font-semibold">Jabatan</th>
                      <th className="px-4 py-3 font-semibold">Sub Divisi</th>
                      <th className="px-4 py-3 font-semibold">Divisi</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">ID Fingerprint</th>
                      <th className="px-4 py-3 font-semibold">Absensi</th>
                      <th className="px-4 py-3 font-semibold">Aktif</th>
                      {canManage && <th className="px-4 py-3 font-semibold">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((row, index) => (
                      <tr key={row.id} className="border-t border-line">
                        <td className="px-4 py-3 tabular-nums text-ink-muted">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                        <td className="px-4 py-3 text-ink-muted">{row.position || '-'}</td>
                        <td className="px-4 py-3 text-ink-muted">{row.subdivision || '-'}</td>
                        <td className="px-4 py-3 text-ink-muted">{row.department || '-'}</td>
                        <td className="px-4 py-3 text-ink-muted">{row.employmentStatus || '-'}</td>
                        <td className="px-4 py-3 tabular-nums text-ink-muted">{row.fingerprintId || '-'}</td>
                        <td className="px-4 py-3 tabular-nums text-ink-muted">{row.attendanceCount}</td>
                        <td className="px-4 py-3">
                          <Chip tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Aktif' : 'Nonaktif'}</Chip>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                aria-label="Ubah karyawan"
                                className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(row)}
                                aria-label={row.isActive ? 'Nonaktifkan karyawan' : 'Aktifkan karyawan'}
                                className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row)}
                                disabled={deletingId === row.id}
                                aria-label="Hapus karyawan"
                                className="rounded-lg p-1.5 text-ink-muted transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 dark:hover:bg-rose-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="divide-y divide-line md:hidden">
              {employees.map((row) => {
                const expanded = mobileExpandedId === row.id
                return (
                  <div key={row.id} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setMobileExpandedId(expanded ? null : row.id)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">{row.department || '-'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Aktif' : 'Nonaktif'}</Chip>
                        <ChevronDown
                          className={clsx('h-4 w-4 text-ink-muted transition-transform', expanded && 'rotate-180')}
                        />
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-3 space-y-3">
                        <dl className="space-y-1.5 rounded-xl border border-line bg-surface-muted px-3 py-2 text-xs">
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-muted">Jabatan</dt>
                            <dd className="text-right font-medium text-ink">{row.position || '-'}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-muted">Sub Divisi</dt>
                            <dd className="text-right font-medium text-ink">{row.subdivision || '-'}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-muted">Divisi</dt>
                            <dd className="text-right font-medium text-ink">{row.department || '-'}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-muted">Status Kepegawaian</dt>
                            <dd className="text-right font-medium text-ink">{row.employmentStatus || '-'}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-muted">ID Fingerprint</dt>
                            <dd className="text-right font-medium text-ink tabular-nums">{row.fingerprintId || '-'}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-muted">Tanggal Masuk</dt>
                            <dd className="text-right font-medium text-ink tabular-nums">{formatDateLabel(row.joinDate)}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-muted">Total Absensi</dt>
                            <dd className="text-right font-medium text-ink tabular-nums">{row.attendanceCount}</dd>
                          </div>
                        </dl>
                        {canManage && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Ubah
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(row)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink"
                            >
                              <Power className="h-3.5 w-3.5" />
                              {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={deletingId === row.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 disabled:opacity-60 dark:border-rose-500/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Hapus
                            </button>
                          </div>
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

      {formModal}
    </div>
  )
}
