
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const priorities = await prisma.priority.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(priorities)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching priorities' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const json = await request.json()
    const { name, color } = json

    if (!name || !color) {
      return NextResponse.json(
        { error: 'Name and color are required' },
        { status: 400 }
      )
    }

    const priority = await (prisma as any).priority.create({
      data: {
        name,
        color,
      },
    })

    return NextResponse.json(priority)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error creating priority' },
      { status: 500 }
    )
  }
}
