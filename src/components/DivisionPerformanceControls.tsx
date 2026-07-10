'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

type DivisionCode = 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'
type PeriodMode = 'WEEKLY' | 'MONTHLY'

type DivisionPerformanceControlsProps = {
  division: DivisionCode
  mode: PeriodMode
  month: number
  year: number
  anchorDate: string
}

function shiftIsoDate(isoDate: string, dayDelta: number) {
  const base = new Date(`${isoDate}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + dayDelta)
  return base.toISOString().slice(0, 10)
}

export function DivisionPerformanceControls({
  division,
  mode,
  month,
  year,
  anchorDate,
}: DivisionPerformanceControlsProps) {
  const router = useRouter()
  const years = [2024, 2025, 2026, 2027]
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ]

  const pushState = (next: {
    mode?: PeriodMode
    month?: number
    year?: number
    anchorDate?: string
  }) => {
    const nextMode = next.mode ?? mode
    const params = new URLSearchParams()
    params.set('division', division)
    params.set('mode', nextMode)

    if (nextMode === 'MONTHLY') {
      params.set('month', String(next.month ?? month))
      params.set('year', String(next.year ?? year))
    } else {
      params.set('date', next.anchorDate ?? anchorDate)
    }

    router.push(`/division-performance?${params.toString()}`)
  }

  const handlePrevious = () => {
    if (mode === 'MONTHLY') {
      const previousMonth = month === 1 ? 12 : month - 1
      const previousYear = month === 1 ? year - 1 : year
      pushState({ month: previousMonth, year: previousYear })
      return
    }

    pushState({ anchorDate: shiftIsoDate(anchorDate, -7) })
  }

  const handleNext = () => {
    if (mode === 'MONTHLY') {
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      pushState({ month: nextMonth, year: nextYear })
      return
    }

    pushState({ anchorDate: shiftIsoDate(anchorDate, 7) })
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => pushState({ mode: 'WEEKLY' })}
          className={clsx(
            'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            mode === 'WEEKLY'
              ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
          )}
        >
          Mingguan
        </button>
        <button
          type="button"
          onClick={() => pushState({ mode: 'MONTHLY' })}
          className={clsx(
            'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            mode === 'MONTHLY'
              ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
          )}
        >
          Bulanan
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrevious}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'MONTHLY' ? (
            <>
              <select
                value={month}
                onChange={(event) => pushState({ month: Number(event.target.value) })}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:ring-gray-600 dark:[color-scheme:dark]"
              >
                {months.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(event) => pushState({ year: Number(event.target.value) })}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:ring-gray-600 dark:[color-scheme:dark]"
              >
                {years.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <input
              type="date"
              value={anchorDate}
              onChange={(event) => pushState({ anchorDate: event.target.value })}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:ring-gray-600 dark:[color-scheme:dark]"
            />
          )}
        </div>
      </div>
    </div>
  )
}
