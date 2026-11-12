'use client'

import Link from 'next/link'
import { getDivisionFromRole, getMenuHref } from '@/lib/access'
import { canShowMobilePsbSummary, getMobileShortcuts, getRoleLabel } from '@/lib/mobile-nav'

type Props = {
  userName: string
  userRole?: string
  statusCounts: { total: number; open: number; close: number; on_progress: number }
  showPsbSummaryOverride?: boolean
  mobileOnly?: boolean
  showWelcome?: boolean
  position?: string | null
  subdivision?: string | null
}

export function MobileHome({
  userName,
  userRole,
  statusCounts,
  showPsbSummaryOverride,
  mobileOnly = true,
  showWelcome = true,
  position,
  subdivision,
}: Props) {
  const firstName = userName.trim().split(/\s+/)[0] || 'Pengguna'
  const roleLabel = getRoleLabel(userRole)
  const roleDivision = getDivisionFromRole(userRole)

  const shortcuts = getMobileShortcuts(userRole, position, subdivision)
  const showPsbSummary = showPsbSummaryOverride ?? canShowMobilePsbSummary(userRole)

  const stats = [
    { label: 'Total PSB', value: statusCounts.total, tone: 'text-slate-900 dark:text-white' },
    { label: 'Open', value: statusCounts.open, tone: 'text-amber-700 dark:text-amber-300' },
    { label: 'Proses', value: statusCounts.on_progress, tone: 'text-blue-700 dark:text-blue-300' },
    { label: 'Close', value: statusCounts.close, tone: 'text-emerald-700 dark:text-emerald-300' },
  ]

  return (
    <section className={mobileOnly ? 'space-y-5 md:hidden' : 'space-y-5'}>
      {showWelcome && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-5 py-5 text-white shadow-sm">
          <p className="text-sm text-blue-100">Ruang kerja {roleLabel}</p>
          <h1 className="mt-1 text-2xl font-bold">Halo, {firstName}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            Akses cepat ke modul yang sesuai dengan izin akun Anda.
          </p>
        </div>
      )}

      {showPsbSummary && (
        <section aria-label="Ringkasan PSB">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Ringkasan PSB</h2>
            <Link
              href={getMenuHref('list', roleDivision)}
              prefetch={false}
              className="text-xs font-medium text-blue-700 dark:text-blue-300"
            >
              Buka data
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${stat.tone}`}>{stat.value.toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {shortcuts.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Akses Cepat</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Modul Anda</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {shortcuts.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.key}
                  href={getMenuHref(item.key, roleDivision)}
                  prefetch={false}
                  className="min-h-28 rounded-xl border border-slate-200 bg-white p-3 transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">{item.label}</p>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{item.detail}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </section>
  )
}
