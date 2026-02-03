
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

  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const json = await request.json()
    const { name, content, isDefault } = json

    if (isDefault) {
      // Unset other defaults
      await (prisma as any).whatsappTemplate.updateMany({
        where: { isDefault: true, id: { not: parseInt(id) } },
        data: { isDefault: false },
      })
    }

    const template = await (prisma as any).whatsappTemplate.update({
      where: { id: parseInt(id) },
      data: {
        name,
        content,
        isDefault,
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error updating template' },
      { status: 500 }
    )
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

  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    await (prisma as any).whatsappTemplate.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ message: 'Template deleted' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error deleting template' },
      { status: 500 }
    )
  }
}
