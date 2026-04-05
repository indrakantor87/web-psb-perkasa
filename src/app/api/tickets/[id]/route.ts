import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { cache } from '@/lib/cache'

function statusOrderFor(status: string) {
  const s = (status || '').toUpperCase()
  if (s === 'OPEN') return 0
  if (s === 'ON_PROGRESS') return 1
  if (s === 'PENDING') return 2
  if (s === 'CLOSE') return 3
  return 9
}

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
    let updateData: Prisma.TicketUncheckedUpdateInput = {}
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
        updateData.hasPhoto = true
      }

      // Handle regular fields
      const customerName = formData.get('customerName')
      if (typeof customerName === 'string' && customerName) updateData.customerName = customerName

      const phoneNumber = formData.get('phoneNumber')
      if (typeof phoneNumber === 'string' && phoneNumber) updateData.phoneNumber = phoneNumber

      const pkg = formData.get('package')
      if (typeof pkg === 'string' && pkg) updateData.package = pkg

      const marketingName = formData.get('marketingName')
      if (typeof marketingName === 'string' && marketingName) updateData.marketingName = marketingName

      const teknisi = formData.get('teknisi')
      if (typeof teknisi === 'string' && teknisi) updateData.teknisi = teknisi

      const description = formData.get('description')
      if (description !== null) updateData.description = description.toString()

      const locationMap = formData.get('locationMap')
      if (typeof locationMap === 'string' && locationMap) updateData.locationMap = locationMap

      const birthDate = formData.get('birthDate')
      if (birthDate) updateData.birthDate = new Date(birthDate.toString())

      const installedDate = formData.get('installedDate')
      if (installedDate) updateData.installedDate = new Date(installedDate.toString())

      status = formData.get('status')?.toString()
      pengawalan = formData.get('pengawalan')?.toString()
      kmz = formData.get('kmz')?.toString()
      priority = formData.get('priority')?.toString()

    } else {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
      console.log(`[API] Updating ticket ${ticketId} by ${session.user.username} (${session.user.role})`, body)
      status = typeof body.status === 'string' ? body.status : undefined
      pengawalan = typeof body.pengawalan === 'string' ? body.pengawalan : undefined
      kmz = typeof body.kmz === 'string' ? body.kmz : undefined
      priority = typeof body.priority === 'string' ? body.priority : undefined

      const allowed = ['customerName', 'phoneNumber', 'package', 'marketingName', 'teknisi', 'description', 'locationMap', 'birthDate', 'installedDate', 'pembayaran'] as const
      const next: Prisma.TicketUncheckedUpdateInput = {}
      for (const k of allowed) {
        const v = body[k]
        if (typeof v === 'undefined' || v === null) continue
        if (k === 'birthDate' || k === 'installedDate') {
          next[k] = new Date(String(v))
        } else {
          next[k] = String(v)
        }
      }
      updateData = next
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

    // Security: Field-level RBAC
    if (session.user.role === 'TEKNISI') {
      // Teknisi cannot change marketing info or package
      delete updateData.marketingName
      delete updateData.package
    }

    if (session.user.role === 'MARKETING') {
      // Marketing cannot change technical info
      delete updateData.teknisi
      delete updateData.installedDate
      // Marketing cannot close tickets (handled below)
    }

    let ticket
    if (status === 'CLOSE') {
      if (session.user.role === 'MARKETING') {
        return NextResponse.json(
          { error: 'Marketing cannot close tickets' },
          { status: 403 }
        )
      }

      const current = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { status: true },
      })
      const installedDateForClose =
        updateData.installedDate instanceof Date
          ? updateData.installedDate
          : typeof updateData.installedDate === 'string'
            ? new Date(updateData.installedDate)
            : new Date()
      if (current?.status === 'CLOSE') {
        ticket = await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            ...updateData,
            status: 'CLOSE',
            statusOrder: statusOrderFor('CLOSE'),
          },
          select: { id: true, status: true },
        })
      } else {
        ticket = await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            ...updateData,
            status: 'CLOSE',
            installedDate: installedDateForClose,
            statusOrder: statusOrderFor('CLOSE'),
            closedById: session.user.id,
          },
          select: { id: true, status: true },
        })
      }
    } else {
      // Normal update (e.g. editing details)
      /* const statusUpdate = status !== undefined ? { 
        status, 
        statusOrder: status === 'OPEN' ? 0 : 1 
      } : {} */

      const data: Prisma.TicketUncheckedUpdateInput = { ...updateData }
      if (typeof status !== 'undefined') {
        data.status = status
        data.statusOrder = statusOrderFor(status)
      }

      ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data,
        select: { id: true, status: true },
      })
    }

    cache.invalidateByPrefix('tickets-list:')
    cache.invalidateByPrefix('tickets:')
    return NextResponse.json(ticket)

  } catch {
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
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
  } catch {
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 })
  }
}
