import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuMutation } from '@/lib/access-server'
import {
  fetchMachineInfo,
  fetchRawLogs,
  importAttendanceLogs,
  normalizeLogs,
  normalizeUsers,
  type MachineUser,
  type RawMachineLog,
} from '@/lib/hr-machine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST: impor log mentah. Bila body.logs diisi, langsung diproses.
// Bila kosong, log ditarik dari mesin terlebih dahulu.
export async function POST(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'hr')
  if (accessError) return accessError

  const body = (await request.json().catch(() => ({}))) as {
    logs?: unknown
    users?: unknown
    ip?: unknown
    port?: unknown
  }
  const ip = typeof body.ip === 'string' && body.ip.trim() ? body.ip.trim() : undefined
  const port = Number(body.port)
  const config = { ip, port: Number.isFinite(port) && port > 0 ? port : undefined }

  try {
    let logs: RawMachineLog[] = []
    let users: MachineUser[] = []

    if (Array.isArray(body.logs) && body.logs.length > 0) {
      logs = normalizeLogs(body.logs)
      users = normalizeUsers(body.users ?? [])
    } else {
      const info = await fetchMachineInfo(config)
      users = info.users
      const raw = await fetchRawLogs(config)
      logs = raw.data
    }

    if (logs.length === 0) {
      return NextResponse.json({ ok: true, result: null, reason: 'Tidak ada log untuk diimpor' })
    }

    const result = await importAttendanceLogs(logs, users)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal mengimpor log absensi' },
      { status: 502 }
    )
  }
}
