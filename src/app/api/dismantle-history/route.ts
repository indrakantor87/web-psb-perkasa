import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canAccessMenu, canDeleteIsolationRecords } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleHistoryTable, listDismantleHistory } from '@/lib/dismantle-history'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function isDatabaseInitError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error)
  return message.includes('tenant/user') || message.includes('PrismaClientInitializationError')
}

function getMarketingScope(role: string | null | undefined, name: string | null | undefined, username: string | null | undefined) {
  if (String(role ?? '').trim().toUpperCase() !== 'MARKETING') return null
  const values = Array.from(
    new Set(
      [name, username]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  )
  return values.length > 0 ? values : null
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canAccessMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
  const marketingOwners = getMarketingScope(session.user.role, session.user.name, session.user.username)

  try {
    await ensureDismantleHistoryTable()
    const payload = await listDismantleHistory({
      search,
      radboox,
      ticketStatus,
      marketingOwners,
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
    if (isDatabaseInitError(error) && process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        {
          items: [],
          total: 0,
          page,
          limit,
          localNotice:
            'Mode lokal aktif: histori dismantle ditampilkan kosong karena koneksi database remote sedang tidak tersedia.',
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return NextResponse.json({ error: 'Failed to fetch dismantle history' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canDeleteIsolationRecords(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await ensureDismantleHistoryTable()
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
      `DELETE FROM "DismantleHistory" WHERE "id" = ANY($1::int[])`,
      ids,
    )
    const count = Number(deleted ?? 0)
    return NextResponse.json({ success: true, count })
  } catch (error) {
    console.error('Failed to bulk delete dismantle history:', error)
    return NextResponse.json({ error: 'Failed to delete dismantle history' }, { status: 500 })
  }
}
