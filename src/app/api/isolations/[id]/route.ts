import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Restrict MARKETING from updating isolations
  if (session.user.role === 'MARKETING') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  try {
    const isolation = await prisma.isolation.update({
      where: { id: parseInt(id) },
      data: {
        ...body,
        restorationDate: body.status === 'CLOSED' ? new Date() : undefined,
      },
    })

    return NextResponse.json(isolation)
  } catch (error) {
    console.error('Failed to update isolation:', error)
    return NextResponse.json({ error: 'Failed to update isolation' }, { status: 500 })
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
  
  // Allow ADMIN, CS, NOC to delete
  if (!['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.isolation.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete isolation:', error)
    return NextResponse.json({ error: 'Failed to delete isolation' }, { status: 500 })
  }
}
