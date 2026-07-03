import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { title, content, contentType, platform, status, publishDate, notes, tags } = data

    const contentItem = await (prisma as any).contentCalendar.update({
      where: { id: parseInt(params.id) },
      data: {
        title,
        content,
        contentType,
        platform,
        status,
        publishDate: publishDate ? new Date(publishDate) : null,
        notes,
        tags: tags || []
      },
      include: {
        creator: { select: { id: true, name: true, username: true } }
      }
    })

    return NextResponse.json(contentItem)
  } catch (error) {
    console.error('Error updating content calendar item:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await (prisma as any).contentCalendar.delete({
      where: { id: parseInt(params.id) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting content calendar item:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
