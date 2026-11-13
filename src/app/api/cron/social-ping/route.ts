import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { runSocialPing } from '@/lib/social-ping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return false

  const provided = Buffer.from(authorization.slice('Bearer '.length))
  const expected = Buffer.from(secret)
  if (provided.length !== expected.length) return false

  return timingSafeEqual(provided, expected)
}

export async function POST(req: Request) {
  const secret = process.env.SOCIAL_PING_CRON_SECRET ?? ''
  if (Buffer.byteLength(secret) < 32) {
    return NextResponse.json({ error: 'Social ping cron is not configured' }, { status: 503 })
  }
  if (!isAuthorized(req, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const timeoutMs = Math.min(15000, Math.max(2000, Number(process.env.SOCIAL_PING_TIMEOUT_MS || 5000)))
  const concurrency = Math.min(6, Math.max(1, Number(process.env.SOCIAL_PING_CONCURRENCY || 3)))

  try {
    const outcomes = await runSocialPing(timeoutMs, concurrency)
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
