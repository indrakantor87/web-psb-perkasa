import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const packages = await (prisma as any).package.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(packages)
  } catch {
    return NextResponse.json({ error: 'Error fetching packages' }, { status: 500 })
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
    const json = (await request.json().catch(() => ({}))) as { name?: string }
    const name = json.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const pkg = await (prisma as any).package.create({
      data: { name },
    })
    cache.invalidateByPrefix('packages:')
    return NextResponse.json(pkg)
  } catch {
    return NextResponse.json({ error: 'Error creating package' }, { status: 500 })
  }
}
