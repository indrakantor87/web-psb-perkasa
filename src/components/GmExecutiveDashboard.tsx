'use client'

import { useGmDashboard } from './GmExecutiveDashboard/useGmDashboard'
import { KpiCards } from './GmExecutiveDashboard/KpiCards'
import {
  ActiveCustomersLineChart,
  CustomersIsolationBarChart,
  DismantleLineChart,
  DivisionPerformance,
  IsolationLineChart,
  TotalCustomersLineChart,
} from './GmExecutiveDashboard/Charts'
import { NetworkSection } from './GmExecutiveDashboard/NetworkSection'
import { ExecutiveSummary, HrSection, RisksTable } from './GmExecutiveDashboard/Panels'
import { MarketingPerformanceTable } from './GmExecutiveDashboard/MarketingPerformanceTable'

export function GmExecutiveDashboard() {
  const { year, setYear, month, setMonth, data, loading, error, years, months, refresh } = useGmDashboard()

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Dashboard GM & Direktur</h1>
            <p className="text-xs md:text-sm text-slate-300 mt-0.5">
              Perkasa Networks • Ringkasan kinerja operasional & strategis
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select
              aria-label="Pilih bulan dashboard"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-white/10 backdrop-blur border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {months.map((item) => (
                <option key={item.value} value={item.value} className="text-slate-800">
                  {item.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Pilih tahun dashboard"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-white/10 backdrop-blur border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {years.map((y) => (
                <option key={y} value={y} className="text-slate-800">
                  Tahun {y}
                </option>
              ))}
            </select>
            <button
              onClick={refresh}
              className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {data && (
          <div className="relative mt-2 text-[11px] text-slate-400">
            Periode: {data.periodLabel} · Data dihasilkan: {new Date(data.generatedAt).toLocaleString('id-ID')}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-slate-400 text-sm">Memuat data dashboard...</div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          Gagal memuat data: {error}
        </div>
      )}

      {data && !loading && (
        <>
          <KpiCards
            kpis={data.kpis}
            deltas={data.deltas}
            periodLabel={data.periodLabel}
            snapshotAvailable={data.snapshotAvailable}
          />

          <div className="hidden lg:block">
            <DivisionPerformance divisions={data.divisions} periodLabel={data.periodLabel} />
          </div>

          <CustomersIsolationBarChart data={data.dailySeries} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TotalCustomersLineChart data={data.dailySeries} />
            <ActiveCustomersLineChart data={data.dailySeries} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IsolationLineChart data={data.dailySeries} />
            <DismantleLineChart data={data.dailySeries} />
          </div>

          <MarketingPerformanceTable rows={data.marketingPerformance} />

          <NetworkSection network={data.network} periodLabel={data.periodLabel} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RisksTable risks={data.risks} />
            </div>
            <HrSection hr={data.hr} />
          </div>

          <ExecutiveSummary summary={data.execSummary} />
        </>
      )}
    </div>
  )
}
