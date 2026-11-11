import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'
import { generateKml } from '@/lib/kml'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuAccess(session, 'jalur')
  if (accessError) return accessError

  try {
    const [jalurList, spliceList] = await Promise.all([
      prisma.jalur.findMany({ orderBy: { id: 'asc' } }),
      prisma.splice.findMany({ orderBy: { id: 'asc' } }),
    ])

    const lines = jalurList.map((j) => {
      const path = (j.path as { latitude: number; longitude: number }[]) || []
      return {
        name: j.nama_jalur || `Jalur ${j.id}`,
        description: j.keterangan || j.jenis,
        color: j.warna,
        coordinates: path,
      }
    })

    const points = spliceList.map((s) => ({
      name: s.nama,
      description: s.keterangan || '',
      color: '#ffff00',
      latitude: s.latitude,
      longitude: s.longitude,
    }))

    const kml = generateKml({ lines, points })
    const timestamp = new Date().toISOString().slice(0, 10)

    return new NextResponse(kml, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml',
        'Content-Disposition': `attachment; filename="jalur-perkasa-${timestamp}.kml"`,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'Gagal export KML' }, { status: 500 })
  }
}
