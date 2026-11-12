import { useCallback, useEffect, useState } from 'react'

export type GmDashboardData = {
  year: number
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
    byPop: Array<{
      popId: number
      popName: string
      ipAddress: string
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
    presentToday: number
    absentToday: number
  }
  risks: Array<{ category: string; count: number; detail: string }>
  execSummary: string
}

const YEARS = [2024, 2025, 2026, 2027]

export function useGmDashboard() {
  const [year, setYear] = useState<number>(() => new Date().getFullYear())
  const [data, setData] = useState<GmDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (y: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/gm-dashboard?year=${y}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as GmDashboardData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(year)
  }, [year, fetchData])

  return { year, setYear, data, loading, error, years: YEARS, refresh: () => fetchData(year) }
}
