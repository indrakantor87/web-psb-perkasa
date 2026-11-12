import { NextResponse } from 'next/server'
import { runNetworkPing } from '@/lib/network-ping'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = process.env.NETWORK_PING_CRON_SECRET
  const auth = req.headers.get('authorization') || ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const timeoutMs = Math.max(1000, Number(process.env.NETWORK_PING_TIMEOUT_MS || 5000))
  const port = Number(process.env.NETWORK_PING_PORT || 80)

  try {
    const outcomes = await runNetworkPing(timeoutMs, port)
    const up = outcomes.filter((o) => o.success).length
    const down = outcomes.length - up
    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      total: outcomes.length,
      up,
      down,
      outcomes,
    })
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: err }, { status: 500 })
  }
}
