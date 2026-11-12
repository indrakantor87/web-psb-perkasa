import { prisma } from '@/lib/prisma'
import { Prisma as PrismaSql } from '@prisma/client'
import { jakartaNow } from '@/lib/jakarta-time'
import { ensureNetworkPingTableOnce } from '@/lib/network-ping-db'
import * as net from 'net'

export type PingTarget = {
  popId: number
  popName: string
  ipAddress: string
}

export type PingOutcome = {
  popId: number
  popName: string
  ipAddress: string
  success: boolean
  latencyMs: number | null
  error: string | null
}

function tcpPing(host: string, port: number, timeoutMs: number): Promise<{ success: boolean; latencyMs: number; error: string | null }> {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = new net.Socket()
    let settled = false

    const finish = (success: boolean, error: string | null) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve({ success, latencyMs: Date.now() - start, error })
    }

    socket.setTimeout(timeoutMs)
    socket.on('connect', () => finish(true, null))
    socket.on('timeout', () => finish(false, `Timeout setelah ${timeoutMs}ms`))
    socket.on('error', (err) => finish(false, err?.message || 'Gagal konek'))
    socket.connect(port, host)
  })
}

export async function runNetworkPing(timeoutMs = 5000, port = 80): Promise<PingOutcome[]> {
  const targets = await prisma.pop.findMany({
    where: { is_active: true, ip_address: { not: null } },
    select: { id: true, nama_pop: true, ip_address: true },
  })

  const outcomes: PingOutcome[] = []
  for (const t of targets) {
    const ip = String(t.ip_address ?? '').trim()
    if (!ip) continue
    const result = await tcpPing(ip, port, timeoutMs)
    outcomes.push({
      popId: t.id,
      popName: t.nama_pop,
      ipAddress: ip,
      success: result.success,
      latencyMs: result.success ? result.latencyMs : null,
      error: result.error,
    })
  }

  if (outcomes.length > 0) {
    await ensureNetworkPingTableOnce()
    const values = outcomes
      .map((o) => PrismaSql.sql`(${o.popId}, ${o.popName}, ${o.ipAddress}, ${o.success}, ${o.latencyMs ?? null}, ${o.error ?? null})`)
      .reduce((acc, v, i) => (i === 0 ? PrismaSql.sql`${v}` : PrismaSql.sql`${acc}, ${v}`))
    await prisma.$executeRaw(PrismaSql.sql`
      INSERT INTO "network_ping_results" ("pop_id", "pop_name", "ip_address", "success", "latency_ms", "error")
      VALUES ${values}
    `)
  }

  return outcomes
}

export type AvailabilityResult = {
  availabilityPercent: number
  totalChecks: number
  successfulChecks: number
  avgLatencyMs: number | null
  downtimeMinutes: number
  lastCheckedAt: Date | null
  byPop: Array<{
    popId: number
    popName: string
    ipAddress: string
    availabilityPercent: number
    totalChecks: number
    successfulChecks: number
    lastSuccessAt: Date | null
    lastFailureAt: Date | null
    currentStatus: 'UP' | 'DOWN' | 'UNKNOWN'
  }>
}

type PingRow = {
  pop_id: number
  pop_name: string
  ip_address: string
  success: boolean
  latency_ms: number | null
  checked_at: Date
}

export async function getNetworkAvailability(from: Date, to: Date): Promise<AvailabilityResult> {
  await ensureNetworkPingTableOnce()
  const rows = await prisma.$queryRaw<PingRow[]>(PrismaSql.sql`
    SELECT pop_id, pop_name, ip_address, success, latency_ms, checked_at
    FROM network_ping_results
    WHERE checked_at >= ${from} AND checked_at <= ${to}
    ORDER BY checked_at ASC
  `)

  const byPopMap = new Map<number, PingRow[]>()
  for (const r of rows) {
    const arr = byPopMap.get(r.pop_id) ?? []
    arr.push(r)
    byPopMap.set(r.pop_id, arr)
  }

  const byPop: AvailabilityResult['byPop'] = []
  let totalChecks = 0
  let successfulChecks = 0
  let totalLatency = 0
  let latencyCount = 0
  let lastCheckedAt: Date | null = null

  for (const [popId, popRows] of byPopMap) {
    const successCount = popRows.filter((r) => r.success).length
    const popTotal = popRows.length
    const availabilityPercent = popTotal > 0 ? (successCount / popTotal) * 100 : 0
    const lastSuccess = popRows.filter((r) => r.success).pop()
    const lastFailure = popRows.filter((r) => !r.success).pop()
    const lastRow = popRows[popRows.length - 1]
    const currentStatus = lastRow ? (lastRow.success ? 'UP' : 'DOWN') : 'UNKNOWN'
    byPop.push({
      popId,
      popName: popRows[0].pop_name,
      ipAddress: popRows[0].ip_address,
      availabilityPercent,
      totalChecks: popTotal,
      successfulChecks: successCount,
      lastSuccessAt: lastSuccess?.checked_at ?? null,
      lastFailureAt: lastFailure?.checked_at ?? null,
      currentStatus,
    })
    totalChecks += popTotal
    successfulChecks += successCount
    for (const r of popRows) {
      if (r.latency_ms != null) {
        totalLatency += r.latency_ms
        latencyCount += 1
      }
    }
    if (!lastCheckedAt || (lastRow && lastRow.checked_at > lastCheckedAt)) {
      lastCheckedAt = lastRow?.checked_at ?? null
    }
  }

  const availabilityPercent = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0
  const failedChecks = totalChecks - successfulChecks
  const windowMinutes = Math.max(1, (to.getTime() - from.getTime()) / 60000)
  const downtimeMinutes = totalChecks > 0 ? (failedChecks / totalChecks) * windowMinutes : 0

  return {
    availabilityPercent,
    totalChecks,
    successfulChecks,
    avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : null,
    downtimeMinutes,
    lastCheckedAt,
    byPop,
  }
}

export { jakartaNow }
