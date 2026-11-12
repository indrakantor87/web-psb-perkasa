'use client'

import { useGmDashboard } from './GmExecutiveDashboard/useGmDashboard'
import { KpiCards } from './GmExecutiveDashboard/KpiCards'
import {
  CustomerTrendChart,
  DivisionPerformance,
  PackageDonut,
  PsbTrendChart,
  TroubleTrendChart,
} from './GmExecutiveDashboard/Charts'
import { NetworkSection } from './GmExecutiveDashboard/NetworkSection'
import { ExecutiveSummary, HrSection, RisksTable } from './GmExecutiveDashboard/Panels'

export function GmExecutiveDashboard() {
  const { year, setYear, data, loading, error, years, refresh } = useGmDashboard()

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
          <div className="flex items-center gap-2">
            <select
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
            Data dihasilkan: {new Date(data.generatedAt).toLocaleString('id-ID')}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-slate-400 text-sm">Memuat data dashboard...</div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Gagal memuat data: {error}
        </div>
      )}

      {data && !loading && (
        <>
          <KpiCards kpis={data.kpis} deltas={data.deltas} />

          <DivisionPerformance divisions={data.divisions} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CustomerTrendChart data={data.customerTrend} />
            <PsbTrendChart data={data.psbTrend} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TroubleTrendChart data={data.troubleTrend} />
            <PackageDonut data={data.packageDistribution} />
          </div>

          <NetworkSection network={data.network} />

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
