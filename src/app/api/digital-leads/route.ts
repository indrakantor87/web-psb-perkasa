import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const source = searchParams.get('source')

    const where: any = {}
    if (status) where.status = status
    if (source) where.source = source

    const digitalLeads = await (prisma as any).digitalLead.findMany({
      where,
      include: {
        campaign: true,
        createdBy: { select: { id: true, name: true, username: true } },
        convertedToTicket: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(digitalLeads)
  } catch (error) {
    console.error('Error fetching digital leads:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { name, phone, email, source, campaignId, message, status, notes } = data

    const digitalLead = await (prisma as any).digitalLead.create({
      data: {
        name,
        phone,
        email,
        source,
        campaignId: campaignId ? parseInt(campaignId) : null,
        message,
        status: status || 'NEW',
        notes,
        createdById: session.user.id
      },
      include: {
        campaign: true,
        createdBy: { select: { id: true, name: true, username: true } },
        convertedToTicket: true
      }
    })

    return NextResponse.json(digitalLead, { status: 201 })
  } catch (error) {
    console.error('Error creating digital lead:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
