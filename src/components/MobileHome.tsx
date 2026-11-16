'use client'

import Link from 'next/link'
import { getDivisionFromRole, getMenuHref } from '@/lib/access'
import { canShowMobilePsbSummary, getMobileShortcuts } from '@/lib/mobile-nav'

type Props = {
  userRole?: string
  statusCounts: { total: number; open: number; close: number; on_progress: number }
  showPsbSummaryOverride?: boolean
  mobileOnly?: boolean
  position?: string | null
  subdivision?: string | null
}

export function MobileHome({
  userRole,
  statusCounts,
  showPsbSummaryOverride,
  mobileOnly = true,
  position,
  subdivision,
}: Props) {
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
