import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canAccessMenu } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleHistoryTable, listDismantleHistory } from '@/lib/dismantle-history'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canAccessMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureDismantleHistoryTable()

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
    const payload = await listDismantleHistory({
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
        page,
        limit,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Failed to fetch dismantle history:', error)
    return NextResponse.json({ error: 'Failed to fetch dismantle history' }, { status: 500 })
  }
}
