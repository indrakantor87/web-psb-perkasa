import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'
import { ensureMenuMutation, unauthorizedResponse } from '@/lib/access-server'

type CoveredAreaDelegate = {
  findMany: (args?: unknown) => Promise<unknown>
  create: (args: unknown) => Promise<unknown>
}

const prismaUnsafe = prisma as unknown as { coveredArea: CoveredAreaDelegate }

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorizedResponse()

  try {
    const areas = await prismaUnsafe.coveredArea.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(areas)
  } catch (error) {
    console.error('Failed to fetch covered areas:', error)
    return NextResponse.json({ error: 'Failed to fetch areas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'settings')
  if (accessError) return accessError

  try {
    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const newArea = await prismaUnsafe.coveredArea.create({
      data: {
        name,
        description,
      },
    })

    cache.invalidateByPrefix('covered-areas:')
    return NextResponse.json(newArea)
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? (error as { code?: string }).code
        : undefined
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Nama area sudah ada' }, { status: 400 })
    }
    console.error('Failed to create covered area:', error)
    return NextResponse.json({ error: 'Failed to create area' }, { status: 500 })
  }
}
