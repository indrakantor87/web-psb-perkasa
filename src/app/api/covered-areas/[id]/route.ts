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

  if (!['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const areaId = parseInt(id)

  try {
    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const updatedArea = await (prisma as any).coveredArea.update({
      where: { id: areaId },
      data: {
        name,
        description,
      },
    })

    cache.invalidateByPrefix('covered-areas:')
    return NextResponse.json(updatedArea)
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? (error as { code?: string }).code
        : undefined
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Nama area sudah ada' }, { status: 400 })
    }
    console.error('Failed to update covered area:', error)
    return NextResponse.json({ error: 'Failed to update area' }, { status: 500 })
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

  if (!['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const areaId = parseInt(id)

  try {
    await (prisma as any).coveredArea.delete({
      where: { id: areaId },
    })

    cache.invalidateByPrefix('covered-areas:')
    return NextResponse.json({ message: 'Area deleted' })
  } catch (error) {
    console.error('Failed to delete covered area:', error)
    return NextResponse.json({ error: 'Failed to delete area' }, { status: 500 })
  }
}
