import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const accessError = ensureMenuAccess(session, 'content-calendar')
    if (accessError) return accessError
    requireSession(session)

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}
    if (status) where.status = status
    if (platform) where.platform = platform
    if (startDate && endDate) {
      where.publishDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    const contentCalendar = await (prisma as any).contentCalendar.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, username: true } }
      },
      orderBy: { publishDate: 'desc' }
    })

    return NextResponse.json(contentCalendar)
  } catch (error) {
    console.error('Error fetching content calendar:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const accessError = ensureMenuMutation(session, 'content-calendar')
    if (accessError) return accessError
    const activeSession = requireSession(session)

    const data = await request.json()
    const { title, content, contentType, platform, status, publishDate, notes, tags } = data

    const contentItem = await (prisma as any).contentCalendar.create({
      data: {
        title,
        content,
        contentType,
        platform,
        status,
        publishDate: publishDate ? new Date(publishDate) : null,
        creatorId: activeSession.user.id,
        notes,
        tags: tags || []
      },
      include: {
        creator: { select: { id: true, name: true, username: true } }
      }
    })

    return NextResponse.json(contentItem, { status: 201 })
  } catch (error) {
    console.error('Error creating content calendar item:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
