import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMenuMutation, requireSession } from '@/lib/access-server'

function parseIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseFloatOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseDateValue(value: unknown): Date {
  if (value instanceof Date) return value
  const str = String(value ?? '').trim()
  if (!str) return new Date()
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (slashMatch) {
    const [, d, m, y] = slashMatch
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10)
    return new Date(year, parseInt(m, 10) - 1, parseInt(d, 10))
  }
  const dt = new Date(str)
  return isNaN(dt.getTime()) ? new Date() : dt
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession()
    const accessError = ensureMenuMutation(session, 'laporan')
    if (accessError) return accessError
    requireSession(session)

    const { id } = await params
    const data = await request.json()

    const report = await prisma.digitalCreatorReport.update({
      where: { id: parseInt(id, 10) },
      data: {
        date: parseDateValue(data.date),
        ratingGoogleMaps: parseFloatOrNull(data.ratingGoogleMaps),
        followersInstagram: parseIntOrNull(data.followersInstagram),
        posterProduksi: parseIntOrNull(data.posterProduksi),
        posterPosting: parseIntOrNull(data.posterPosting),
        videoProduksi: parseIntOrNull(data.videoProduksi),
        videoPosting: parseIntOrNull(data.videoPosting),
        highPerformingIg: parseIntOrNull(data.highPerformingIg),
        highPerformingTiktok: parseIntOrNull(data.highPerformingTiktok),
        messageIg: parseIntOrNull(data.messageIg),
        messageGoogleReview: parseIntOrNull(data.messageGoogleReview),
        kendalaTeknis: data.kendalaTeknis ? String(data.kendalaTeknis).trim() : null,
        kendalaNonTeknis: data.kendalaNonTeknis ? String(data.kendalaNonTeknis).trim() : null,
        keterangan: data.keterangan ? String(data.keterangan).trim() : null,
      },
      include: {
        createdBy: { select: { id: true, name: true, username: true } },
      },
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error updating laporan:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession()
    const accessError = ensureMenuMutation(session, 'laporan')
    if (accessError) return accessError
    requireSession(session)

    const { id } = await params
    await prisma.digitalCreatorReport.delete({
      where: { id: parseInt(id, 10) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting laporan:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
