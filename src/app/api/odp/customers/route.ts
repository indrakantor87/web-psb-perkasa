import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuAccess(session, 'odp')
  if (accessError) return accessError
  
  const url = new URL(req.url)
  const odpId = url.searchParams.get('odpId')

  if (!odpId) {
    return NextResponse.json({ error: 'odpId is required' }, { status: 400 })
  }

  try {
    const rows = await prisma.ticket.findMany({
      where: {
        odpId: Number(odpId),
      },
      select: {
        id: true,
        customerName: true,
        phoneNumber: true,
        package: true,
        status: true,
        portNumber: true,
      },
      orderBy: {
        portNumber: 'asc',
      },
    })
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
