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
    const contentType = request.headers.get('content-type') || ''
    let updateData: any = {}
    let status: string | undefined
    let pengawalan: string | undefined
    let kmz: string | undefined
    let priority: string | undefined

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      
      // Handle file upload
      const file = formData.get('fotoRumah') as File | null
      if (file && file.size > 0) {
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg']
        if (!validTypes.includes(file.type)) {
          return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
        }
        if (file.size > 3 * 1024 * 1024) {
          return NextResponse.json({ error: 'File too large' }, { status: 400 })
        }
        const buffer = Buffer.from(await file.arrayBuffer())
        updateData.fotoRumah = `data:${file.type};base64,${buffer.toString('base64')}`
      }

      // Handle regular fields
      const customerName = formData.get('customerName')
      if (customerName) updateData.customerName = customerName

      const phoneNumber = formData.get('phoneNumber')
      if (phoneNumber) updateData.phoneNumber = phoneNumber

      const pkg = formData.get('package')
      if (pkg) updateData.package = pkg

      const marketingName = formData.get('marketingName')
      if (marketingName) updateData.marketingName = marketingName

      const teknisi = formData.get('teknisi')
      if (teknisi) updateData.teknisi = teknisi

      const description = formData.get('description')
      if (description !== null) updateData.description = description.toString()

      const locationMap = formData.get('locationMap')
      if (locationMap) updateData.locationMap = locationMap

      const birthDate = formData.get('birthDate')
      if (birthDate) updateData.birthDate = new Date(birthDate.toString())

      const installedDate = formData.get('installedDate')
      if (installedDate) updateData.installedDate = new Date(installedDate.toString())

      status = formData.get('status')?.toString()
      pengawalan = formData.get('pengawalan')?.toString()
      kmz = formData.get('kmz')?.toString()
      priority = formData.get('priority')?.toString()

    } else {
      const body = await request.json()
      console.log(`[API] Updating ticket ${ticketId} by ${session.user.username} (${session.user.role})`, body)
      const { status: s, pengawalan: p, kmz: k, priority: pri, ...restData } = body
      status = s
      pengawalan = p
      kmz = k
      priority = pri
      updateData = { ...restData }
      
      // Handle installedDate if present in JSON
      if (updateData.installedDate) {
        updateData.installedDate = new Date(updateData.installedDate)
      }
    }

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
      if (['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(session.user.role)) {
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
          // statusOrder: 1, // Temporarily disabled
          installedDate: new Date(),
          closedById: session.user.id,
          ...updateData
        },
        select: { id: true, status: true } // Optimization: Only return minimal fields
      } as any)
    } else {
      // Normal update (e.g. editing details)
      /* const statusUpdate = status !== undefined ? { 
        status, 
        statusOrder: status === 'OPEN' ? 0 : 1 
      } : {} */

      ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status, // Reverted to simple status update
          // ...statusUpdate,
          ...updateData
        } as any,
        select: { id: true, status: true } // Optimization: Only return minimal fields
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
      select: { id: true }
    })
    return NextResponse.json({ message: 'Ticket deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 })
  }
}
