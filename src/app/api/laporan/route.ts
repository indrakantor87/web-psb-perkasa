import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'
import { resolveAccountOwnerFilter } from '@/lib/access'

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
  // dd/mm/yyyy
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (slashMatch) {
    const [, d, m, y] = slashMatch
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10)
    return new Date(year, parseInt(m, 10) - 1, parseInt(d, 10))
  }
  const dt = new Date(str)
  return isNaN(dt.getTime()) ? new Date() : dt
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const accessError = ensureMenuAccess(session, 'laporan')
    if (accessError) return accessError
    const activeSession = requireSession(session)

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Prisma.DigitalCreatorReportWhereInput = {}
    const ownerFilter = resolveAccountOwnerFilter(activeSession.user.role, activeSession.user.id)
    if (ownerFilter !== null) where.createdById = ownerFilter
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.date.lte = end
      }
    }

    const reports = await prisma.digitalCreatorReport.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, username: true } },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    })

    return NextResponse.json(reports)
  } catch (error) {
    console.error('Error fetching laporan:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const accessError = ensureMenuMutation(session, 'laporan')
    if (accessError) return accessError
    const activeSession = requireSession(session)

    const data = await request.json()

    const report = await prisma.digitalCreatorReport.create({
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
        createdById: activeSession.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, username: true } },
      },
    })

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('Error creating laporan:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
