import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'
import { resolveAccountOwnerFilter } from '@/lib/access'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const accessError = ensureMenuAccess(session, 'campaigns')
    if (accessError) return accessError
    const activeSession = requireSession(session)

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')

    const where: Prisma.CampaignWhereInput = {}
    const ownerFilter = resolveAccountOwnerFilter(activeSession.user.role, activeSession.user.id)
    if (ownerFilter !== null) where.createdById = ownerFilter
    if (status) where.status = status

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, username: true } }
      },
      orderBy: { startDate: 'desc' }
    })

    return NextResponse.json(campaigns)
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const accessError = ensureMenuMutation(session, 'campaigns')
    if (accessError) return accessError
    const activeSession = requireSession(session)

    const data = await request.json()
    const { name, description, startDate, endDate, budget, status, objectives, platforms } = data

    const campaign = await prisma.campaign.create({
      data: {
        name,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        budget: budget ? parseFloat(budget) : null,
        status,
        objectives: objectives || [],
        platforms: platforms || [],
        createdById: activeSession.user.id
      },
      include: {
        createdBy: { select: { id: true, name: true, username: true } }
      }
    })

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
