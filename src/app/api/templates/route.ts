
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { ensureMenuMutation, unauthorizedResponse } from '@/lib/access-server'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorizedResponse()

  try {
    const templates = await prisma.whatsappTemplate.findMany({
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
  const accessError = ensureMenuMutation(session, 'settings')
  if (accessError) return accessError

  try {
    const json = (await request.json().catch(() => ({}))) as { name?: string; content?: string; isDefault?: boolean }
    const name = json.name
    const content = json.content
    const isDefault = json.isDefault

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      )
    }

    if (isDefault) {
      // Unset other defaults
      await prisma.whatsappTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await prisma.whatsappTemplate.create({
      data: {
        name,
        content,
        isDefault: isDefault || false,
      },
    })
    cache.invalidateByPrefix('templates:')
    return NextResponse.json(template)
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Error creating template' },
      { status: 500 }
    )
  }
}
