import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const ticketId = parseInt(id)

  try {
    const body = await request.json()
    const { status, pengawalan, kmz, priority, ...restData } = body

    // Prepare update data with role-based filtering
    const updateData: any = { ...restData }

    // Only allow authorized roles to update pengawalan
    if (pengawalan !== undefined) {
      if (['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
        updateData.pengawalan = pengawalan
      }
    }
    // Only allow authorized roles to update kmz
    if (kmz !== undefined) {
      if (['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
        updateData.kmz = kmz
      }
    }
    // Only allow authorized roles to update priority
    if (priority !== undefined) {
      if (['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
         updateData.priority = priority
       } else {
         return NextResponse.json({ error: 'Unauthorized to update priority' }, { status: 403 })
       }
    }

    // Check if trying to close ticket
    let ticket;
    if (status === 'CLOSE') {
      if (session.user.role === 'MARKETING') {
        return NextResponse.json(
          { error: 'Marketing cannot close tickets' },
          { status: 403 }
        )
      }

      ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'CLOSE',
          installedDate: new Date(),
          closedById: session.user.id,
          ...updateData
        },
      } as any)
    } else {
      // Normal update (e.g. editing details)
      ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status, // If passed, or undefined
          ...updateData
        } as any,
      })
    }

    return NextResponse.json(ticket)

  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message || 'Failed to update ticket' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowedDeleteRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedDeleteRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const { id } = await params
  
  try {
    await prisma.ticket.delete({
      where: { id: parseInt(id) },
    })
    return NextResponse.json({ message: 'Ticket deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 })
  }
}
