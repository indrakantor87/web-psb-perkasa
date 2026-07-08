import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canAccessMenu, canDeleteIsolationRecords } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleTicketsTable, listDismantleTickets } from '@/lib/dismantle-tickets'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canAccessMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureDismantleTicketsTable()

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const radboox = searchParams.get('radboox')
  const ticketStatusRaw = (searchParams.get('ticketStatus') ?? 'ALL').trim().toUpperCase()
  const ticketStatus = ticketStatusRaw === 'WITH' || ticketStatusRaw === 'WITHOUT' ? ticketStatusRaw : 'ALL'
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
  const limit = (() => {
    const n = parseInt(searchParams.get('limit') || '25', 10)
    if ([25, 50, 75, 100].includes(n)) return n
    return 25
  })()

  try {
    const payload = await listDismantleTickets({
      search,
      radboox,
      ticketStatus,
      page,
      limit,
    })
    return NextResponse.json(
      {
        items: payload.items,
        total: payload.total,
        withTicketTotal: payload.withTicketTotal,
        withoutTicketTotal: payload.withoutTicketTotal,
        page,
        limit,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Failed to fetch dismantle tickets:', error)
    return NextResponse.json({ error: 'Failed to fetch dismantle tickets' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canDeleteIsolationRecords(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureDismantleTicketsTable()

  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
    const idsRaw = body?.ids
    const ids =
      Array.isArray(idsRaw)
        ? idsRaw
            .map((item) => (typeof item === 'number' ? item : typeof item === 'string' ? parseInt(item, 10) : NaN))
            .filter((item): item is number => Number.isFinite(item))
        : []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal satu data yang akan dihapus' }, { status: 400 })
    }

    const deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM "DismantleTickets" WHERE "id" = ANY($1::int[])`,
      ids,
    )
    const count = Number(deleted ?? 0)
    return NextResponse.json({ success: true, count })
  } catch (error) {
    console.error('Failed to bulk delete dismantle tickets:', error)
    return NextResponse.json({ error: 'Failed to delete dismantle tickets' }, { status: 500 })
  }
}

