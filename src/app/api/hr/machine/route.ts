import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess, ensureMenuMutation } from '@/lib/access-server'
import { fetchMachineInfo, getMachineConfig, saveMachineConfig } from '@/lib/hr-machine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'hr')
  if (accessError) return accessError

  try {
    const config = await getMachineConfig()
    try {
      const info = await fetchMachineInfo()
      return NextResponse.json({
        config: info.config,
        connected: true,
        logCounts: info.logCounts,
        logCapacity: info.logCapacity,
        userCounts: info.userCounts,
        users: info.users,
      })
    } catch (error) {
      return NextResponse.json({
        config,
        connected: false,
        error: error instanceof Error ? error.message : 'Tidak dapat terhubung ke mesin fingerprint',
      })
    }
  } catch {
    return NextResponse.json({ error: 'Gagal memuat konfigurasi mesin' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'hr')
  if (accessError) return accessError

  const body = (await request.json().catch(() => ({}))) as { ip?: unknown; port?: unknown }
  const ip = typeof body.ip === 'string' ? body.ip.trim() : ''
  const port = Number(body.port)

  if (!ip) {
    return NextResponse.json({ error: 'IP mesin wajib diisi' }, { status: 400 })
  }
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    return NextResponse.json({ error: 'Port mesin tidak valid' }, { status: 400 })
  }

  try {
    const saved = await saveMachineConfig({ ip, port })
    return NextResponse.json({ config: { ip: saved.machineIp, port: saved.machinePort } })
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan konfigurasi mesin' }, { status: 500 })
  }
}
