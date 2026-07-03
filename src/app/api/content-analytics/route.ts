import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const accessError = ensureMenuAccess(session, 'analytics')
    if (accessError) return accessError
    requireSession(session)

    const searchParams = request.nextUrl.searchParams
    const platform = searchParams.get('platform')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const contentId = searchParams.get('contentId')
    const campaignId = searchParams.get('campaignId')

    const where: any = {}
    if (platform) where.platform = platform
    if (contentId) where.contentId = parseInt(contentId)
    if (campaignId) where.campaignId = parseInt(campaignId)
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    const analytics = await (prisma as any).contentAnalytics.findMany({
      where,
      include: {
        content: true,
        campaign: true
      },
      orderBy: { date: 'desc' }
    })

    // Aggregated summary
    const summary = await (prisma as any).contentAnalytics.aggregate({
      where,
      _sum: {
        reach: true,
        impressions: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        clicks: true,
        followersGain: true
      }
    })

    return NextResponse.json({ analytics, summary })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const accessError = ensureMenuMutation(session, 'analytics')
    if (accessError) return accessError
    requireSession(session)

    const data = await request.json()
    const { contentId, campaignId, platform, date, reach, impressions, likes, comments, shares, saves, clicks, followersGain } = data

    const analytics = await (prisma as any).contentAnalytics.create({
      data: {
        contentId: contentId ? parseInt(contentId) : null,
        campaignId: campaignId ? parseInt(campaignId) : null,
        platform,
        date: new Date(date),
        reach: reach || 0,
        impressions: impressions || 0,
        likes: likes || 0,
        comments: comments || 0,
        shares: shares || 0,
        saves: saves || 0,
        clicks: clicks || 0,
        followersGain: followersGain || 0
      },
      include: {
        content: true,
        campaign: true
      }
    })

    return NextResponse.json(analytics, { status: 201 })
  } catch (error) {
    console.error('Error creating analytics:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
