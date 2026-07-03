import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMenuMutation } from '@/lib/access-server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    const accessError = ensureMenuMutation(session, 'digital-leads')
    if (accessError) return accessError

    const { id } = await params
    const data = await request.json()
    const { name, phone, email, source, campaignId, message, status, notes, convertedToTicketId } = data

    const digitalLead = await (prisma as any).digitalLead.update({
      where: { id: parseInt(id) },
      data: {
        name,
        phone,
        email,
        source,
        campaignId: campaignId ? parseInt(campaignId) : null,
        message,
        status,
        notes,
        convertedToTicketId: convertedToTicketId ? parseInt(convertedToTicketId) : null
      },
      include: {
        campaign: true,
        createdBy: { select: { id: true, name: true, username: true } },
        convertedToTicket: true
      }
    })

    return NextResponse.json(digitalLead)
  } catch (error) {
    console.error('Error updating digital lead:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    const accessError = ensureMenuMutation(session, 'digital-leads')
    if (accessError) return accessError

    const { id } = await params
    await (prisma as any).digitalLead.delete({
      where: { id: parseInt(id) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting digital lead:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
