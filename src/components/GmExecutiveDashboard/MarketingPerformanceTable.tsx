'use client'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { SectionHeading } from '@/components/ui/SectionHeading'
import type { GmDashboardData } from './useGmDashboard'

type MarketingRow = GmDashboardData['marketingPerformance'][number]

export function MarketingPerformanceTable({ rows }: { rows: MarketingRow[] }) {
  const router = useRouter()
  const totals = rows.reduce(
    (result, row) => ({
      count: result.count + row.count,
      open: result.open + row.open,
      on_progress: result.on_progress + row.on_progress,
      close: result.close + row.close,
      isolir: result.isolir + row.isolir,
    }),
    { count: 0, open: 0, on_progress: 0, close: 0, isolir: 0 }
  )

  return (
    <Card className="p-5 sm:p-6">
      <SectionHeading
        title="Kinerja Marketing"
        description="Ringkasan progres per marketing"
        badge={<Chip tone="neutral">Target close</Chip>}
        className="mb-5"
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Nama Marketing</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Progres</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Close</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">On Process</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Open</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink">Total</th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Isolir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const progress = (row.close / 20) * 100
              const progressColor = progress >= 75 ? 'bg-emerald-500' : progress >= 50 ? 'bg-amber-500' : 'bg-rose-500'

              return (
                <tr key={row.name} className="transition-colors hover:bg-surface-muted">
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className="text-sm font-medium text-ink">{row.name}</span>
                  </td>
                  <td className="px-4 py-2 align-middle">
                    <div className="mx-auto w-full max-w-[110px]">
                      <div className="mb-1 text-right text-[10px] leading-none tabular-nums text-ink-muted">{Math.round(progress)}%</div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-line">
                        <div className={`h-1 rounded-full ${progressColor}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-center"><Chip tone="success">{row.close}</Chip></td>
                  <td className="whitespace-nowrap px-4 py-2 text-center"><Chip tone="info">{row.on_progress}</Chip></td>
                  <td className="whitespace-nowrap px-4 py-2 text-center"><Chip tone="danger">{row.open}</Chip></td>
                  <td className="whitespace-nowrap px-4 py-2 text-center">
                    <span className="text-sm font-bold tabular-nums text-ink">{row.count}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => router.push(`/isolir?marketing=${encodeURIComponent(row.name)}&status=OPEN`)}
                      className="inline-flex items-center justify-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                      title={`Lihat isolir untuk ${row.name}`}
                    >
                      {row.isolir}
                    </button>
                  </td>
                </tr>
              )
            })}
            {rows.length > 0 && (
              <tr className="border-t border-line bg-surface-muted font-bold">
                <td className="whitespace-nowrap px-4 py-2 text-ink">TOTAL</td>
                <td className="px-4 py-2" />
                <td className="whitespace-nowrap px-4 py-2 text-center tabular-nums text-emerald-700 dark:text-emerald-400">{totals.close}</td>
                <td className="whitespace-nowrap px-4 py-2 text-center tabular-nums text-blue-700 dark:text-blue-400">{totals.on_progress}</td>
                <td className="whitespace-nowrap px-4 py-2 text-center tabular-nums text-rose-700 dark:text-rose-400">{totals.open}</td>
                <td className="whitespace-nowrap px-4 py-2 text-center tabular-nums text-ink">{totals.count}</td>
                <td className="whitespace-nowrap px-4 py-2 text-center tabular-nums text-orange-700 dark:text-orange-400">{totals.isolir}</td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm italic text-ink-muted">
                  Tidak ada data marketing untuk periode ini
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
