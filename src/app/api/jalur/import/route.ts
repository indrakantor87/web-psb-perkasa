import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuMutation, requireSession } from '@/lib/access-server'
import { parseKml } from '@/lib/kml'
import JSZip from 'jszip'

export const runtime = 'nodejs'

// Default warna berdasarkan jenis (bisa di-override oleh warna dari KML)
const DEFAULT_BACKBONE_COLOR = '#00ffff' // cyan
const DEFAULT_DISTRIBUSI_COLOR = '#800080' // ungu

/**
 * Tentukan jenis jalur berdasarkan warna:
 * - Cyan/tosca -> BACKBONE
 * - Selain itu -> DISTRIBUSI
 */
function inferJenisFromColor(color?: string): 'BACKBONE' | 'DISTRIBUSI' {
  if (!color) return 'DISTRIBUSI'
  const c = color.toUpperCase()
  // Cyan / aqua / turquoise
  if (c === '#00FFFF' || c === '#00CED1' || c === '#40E0D0' || c === '#48D1CC' || c === '#008B8B') return 'BACKBONE'
  return 'DISTRIBUSI'
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuMutation(session, 'jalur')
  if (accessError) return accessError
  const activeSession = requireSession(session)

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    let kmlContent = ''

    if (fileName.endsWith('.kml')) {
      kmlContent = await file.text()
    } else if (fileName.endsWith('.kmz')) {
      // KMZ adalah zip yang berisi file doc.kml
      const buffer = Buffer.from(await file.arrayBuffer())
      const zip = await JSZip.loadAsync(buffer)
      const kmlFile = zip.file(/\.kml$/i)[0]
      if (!kmlFile) {
        return NextResponse.json({ error: 'File KMZ tidak berisi file KML' }, { status: 400 })
      }
      kmlContent = await kmlFile.async('string')
    } else {
      return NextResponse.json({ error: 'Format file tidak didukung. Gunakan .kml atau .kmz' }, { status: 400 })
    }

    const parsed = parseKml(kmlContent)

    const createdBy = activeSession.user.name || activeSession.user.username || null
    const jalurIds: number[] = []
    const spliceIds: number[] = []

    // Simpan jalur (lines)
    for (const line of parsed.lines) {
      const jenis = inferJenisFromColor(line.color)
      const warna = line.color || (jenis === 'BACKBONE' ? DEFAULT_BACKBONE_COLOR : DEFAULT_DISTRIBUSI_COLOR)
      const jalur = await prisma.jalur.create({
        data: {
          nama_jalur: line.name || null,
          jenis,
          warna,
          path: line.coordinates,
          keterangan: line.description || null,
          created_by: createdBy,
        },
      })
      jalurIds.push(jalur.id)
    }

    // Simpan splice (points)
    for (const point of parsed.points) {
      const splice = await prisma.splice.create({
        data: {
          nama: point.name || 'S',
          latitude: point.latitude,
          longitude: point.longitude,
          keterangan: point.description || null,
        },
      })
      spliceIds.push(splice.id)
    }

    return NextResponse.json({
      ok: true,
      jalurCount: jalurIds.length,
      spliceCount: spliceIds.length,
      jalurIds,
      spliceIds,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'Gagal import file' }, { status: 500 })
  }
}
