import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const activityId = parseInt(id)

  try {
    const body = await request.json()
    const { date, marketingName, activity, notes, areaId } = body

    const updatedActivity = await prisma.marketingActivity.update({
      where: { id: activityId },
      data: {
        date: date ? new Date(date) : undefined,
        marketingName,
        activity,
        notes,
        areaId: areaId !== undefined ? (areaId ? parseInt(areaId) : null) : undefined,
      },
    })

    cache.invalidateByPrefix('marketing-activities:')
    return NextResponse.json(updatedActivity)
  } catch (error) {
    console.error('Failed to update marketing activity:', error)
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 })
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
  const activityId = parseInt(id)

  try {
    await prisma.marketingActivity.delete({
      where: { id: activityId },
    })

    cache.invalidateByPrefix('marketing-activities:')
    return NextResponse.json({ message: 'Activity deleted' })
  } catch (error) {
    console.error('Failed to delete marketing activity:', error)
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 })
  }
}
