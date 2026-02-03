
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const templates = await (prisma as any).whatsappTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Error fetching templates' },
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
    const { name, content, isDefault } = json

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      )
    }

    if (isDefault) {
      // Unset other defaults
      await (prisma as any).whatsappTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await (prisma as any).whatsappTemplate.create({
      data: {
        name,
        content,
        isDefault: isDefault || false,
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Error creating template' },
      { status: 500 }
    )
  }
}
