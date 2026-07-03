
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { getSession } from '@/lib/auth'
import { ensureMenuMutation } from '@/lib/access-server'

export async function GET() {
  try {
    const priorities = await prisma.priority.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(priorities)
  } catch {
    return NextResponse.json(
      { error: 'Error fetching priorities' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'settings')
  if (accessError) return accessError

  try {
    const json = (await request.json().catch(() => ({}))) as { name?: string; color?: string }
    const name = json.name
    const color = json.color

    if (!name || !color) {
      return NextResponse.json(
        { error: 'Name and color are required' },
        { status: 400 }
      )
    }

    const priority = await prisma.priority.create({
      data: {
        name,
        color,
      },
    })
    cache.invalidateByPrefix('priorities:')
    return NextResponse.json(priority)
  } catch {
    return NextResponse.json(
      { error: 'Error creating priority' },
      { status: 500 }
    )
  }
}
