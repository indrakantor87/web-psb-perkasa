import { useCallback, useEffect, useState } from 'react'
import { jakartaNow } from '@/lib/jakarta-time'
import { GM_DASHBOARD_MONTHS } from '@/lib/gm-dashboard-period'

export type GmDashboardData = {
  year: number
  month: number
  periodLabel: string
  snapshotAvailable: boolean
  generatedAt: string
  kpis: {
    totalCustomers: number
    activeCustomers: number
    customerDeclinePercent: number
    psbInstalled: number
    availabilityPercent: number
    ttCloseRate: number
    mttrHours: number
    isolationCloseRate: number
  }
  deltas: {
    customerGrowth: number
    activeGrowth: number
    psbGrowth: number
  }
  divisions: Array<{
    code: string
    label: string
    primaryValue: number
    primaryLabel: string
    valueSuffix?: string
    secondaryValue: number
    secondaryLabel: string
    secondarySuffix?: string
    progress: number
    members: number
  }>
  marketingPerformance: Array<{
    name: string
    count: number
    open: number
    on_progress: number
    close: number
    isolir: number
  }>
  dailySeries: Array<{
    date: string
    label: string
    totalCustomers: number
    activeCustomers: number
    isolationContinued: number
    isolationNotContinued: number
    dismantleOpen: number
    dismantleClosed: number
  }>
  customerTrend: Array<{ month: string; totalCustomers: number; activeCustomers: number }>
  psbTrend: Array<{ month: string; installed: number }>
  troubleTrend: {
    months: string[]
    rows: Array<{ name: string; total: number; byMonth: number[] }>
  }
  packageDistribution: Array<{ name: string; count: number }>
  network: {
    odpTotal: number
    popCount: number
    portCapacity: number
    portUsed: number
    portUtilization: number
    availabilityPercent: number
    avgLatencyMs: number | null
    downtimeMinutes: number
    lastCheckedAt: string | null
    byPlatform: Array<{
      platform: string
      label: string
      availabilityPercent: number
      totalChecks: number
      successfulChecks: number
      currentStatus: 'UP' | 'DOWN' | 'UNKNOWN'
    }>
    odpMapPoints: Array<{
      id: number
      name: string
      wilayah: string
      kapasitas: number
      terpakai: number
      latitude: number
      longitude: number
    }>
  }
  hr: {
    activeEmployees: number
    averagePresentPerDay: number
    averageAbsentPerDay: number
    attendanceDays: number
  }
  risks: Array<{ category: string; count: number; detail: string }>
  execSummary: string
}

const FIRST_YEAR = 2024
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: Math.max(1, CURRENT_YEAR - FIRST_YEAR + 2) }, (_, index) => FIRST_YEAR + index)

export function useGmDashboard() {
  const [initialPeriod] = useState(() => {
    const now = jakartaNow()
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
  })
  const [year, setYear] = useState(initialPeriod.year)
  const [month, setMonth] = useState(initialPeriod.month)
  const [data, setData] = useState<GmDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (y: number, m: number, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/gm-dashboard?year=${y}&month=${m}`, { cache: 'no-store', signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as GmDashboardData
      setData(json)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Gagal memuat data')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetchData(year, month, controller.signal)
    return () => controller.abort()
  }, [year, month, fetchData])

  return {
    year,
    setYear,
    month,
    setMonth,
    data,
    loading,
    error,
    years: YEARS,
    months: GM_DASHBOARD_MONTHS,
    refresh: () => fetchData(year, month),
  }
}
