import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'

export const runtime = 'nodejs'

type PathPoint = { latitude: number; longitude: number }

function isValidPath(path: unknown): path is PathPoint[] {
  if (!Array.isArray(path) || path.length < 2) return false
  return path.every(
    (p) =>
      p &&
      typeof p === 'object' &&
      typeof (p as PathPoint).latitude === 'number' &&
      typeof (p as PathPoint).longitude === 'number' &&
      Number.isFinite((p as PathPoint).latitude) &&
      Number.isFinite((p as PathPoint).longitude),
  )
}

export async function GET() {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuAccess(session, 'jalur')
  if (accessError) return accessError

  try {
    const jalur = await prisma.jalur.findMany({
      orderBy: { id: 'asc' },
      include: { splices: { orderBy: { id: 'asc' } } },
    })
    return NextResponse.json(jalur)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'Gagal memuat jalur' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuMutation(session, 'jalur')
  if (accessError) return accessError
  const activeSession = requireSession(session)

  try {
    const body = await req.json()
    const nama_jalur = typeof body.nama_jalur === 'string' ? body.nama_jalur.trim() : null
    const jenis = body.jenis === 'BACKBONE' ? 'BACKBONE' : 'DISTRIBUSI'
    const warna = typeof body.warna === 'string' && body.warna.startsWith('#') ? body.warna : '#00ffff'
    const path = body.path

    if (!isValidPath(path)) {
      return NextResponse.json({ error: 'Path jalur tidak valid (minimal 2 titik koordinat)' }, { status: 400 })
    }

    const jalur = await prisma.jalur.create({
      data: {
        nama_jalur: nama_jalur || null,
        jenis,
        warna,
        path,
        pop_id: typeof body.pop_id === 'number' ? body.pop_id : null,
        odc_id: typeof body.odc_id === 'number' ? body.odc_id : null,
        keterangan: typeof body.keterangan === 'string' ? body.keterangan : null,
        created_by: activeSession.user.name || activeSession.user.username || null,
      },
    })

    return NextResponse.json(jalur, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'Gagal menyimpan jalur' }, { status: 500 })
  }
}
