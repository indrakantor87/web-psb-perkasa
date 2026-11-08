import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuMutation } from '@/lib/access-server'
import { syncAttendanceFromMachine } from '@/lib/hr-machine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'hr')
  if (accessError) return accessError

  const body = (await request.json().catch(() => ({}))) as { ip?: unknown; port?: unknown }
  const ip = typeof body.ip === 'string' && body.ip.trim() ? body.ip.trim() : undefined
  const port = Number(body.port)

  try {
    const result = await syncAttendanceFromMachine({
      ip,
      port: Number.isFinite(port) && port > 0 ? port : undefined,
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal sinkronisasi absensi dari mesin' },
      { status: 502 }
    )
  }
}
