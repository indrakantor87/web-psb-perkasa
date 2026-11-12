import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'
import { ensureSpliceKmlIconStyleColumn } from '@/lib/splice-kml-schema'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuAccess(session, 'jalur')
  if (accessError) return accessError

  try {
    await ensureSpliceKmlIconStyleColumn()
    const splices = await prisma.splice.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        nama: true,
        latitude: true,
        longitude: true,
        keterangan: true,
        jalur_id: true,
        kml_icon_style: true,
      },
    })
    return NextResponse.json(splices)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'Gagal memuat splice' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuMutation(session, 'jalur')
  if (accessError) return accessError
  requireSession(session)

  try {
    await ensureSpliceKmlIconStyleColumn()
    const body = await req.json()
    const nama = typeof body.nama === 'string' && body.nama.trim() ? body.nama.trim() : 'S'
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'Koordinat tidak valid' }, { status: 400 })
    }

    const splice = await prisma.splice.create({
      data: {
        nama,
        latitude,
        longitude,
        keterangan: typeof body.keterangan === 'string' ? body.keterangan : null,
        jalur_id: typeof body.jalur_id === 'number' ? body.jalur_id : null,
      },
    })

    return NextResponse.json(splice, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'Gagal menyimpan splice' }, { status: 500 })
  }
}
