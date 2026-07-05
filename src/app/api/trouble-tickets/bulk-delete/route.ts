import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { deletePhotosForTicket, ensurePhotoTableOnce } from '@/lib/trouble-ticket-photo-store'
import { canMutateTroubleTicketRecords } from '@/lib/access'

export const runtime = 'nodejs'

async function ensureTroubleTicketTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicket" (
      "id" SERIAL NOT NULL,
      "ticketCode" TEXT,
      "ticketPrefix" TEXT,
      "ticketNumber" INT,
      "customerName" TEXT NOT NULL,
      "user" TEXT,
      "waNumber" TEXT NOT NULL,
      "mapsUrl" TEXT,
      "type" TEXT NOT NULL,
      "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "closedAt" TIMESTAMP(3),
      "notes" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TroubleTicket_pkey" PRIMARY KEY ("id")
    );
  `)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canMutateTroubleTicketRecords(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureTroubleTicketTable().catch(() => {})
  await ensurePhotoTableOnce().catch(() => {})

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown }
  const idsRaw = Array.isArray(body.ids) ? body.ids : []
  const ids = Array.from(
    new Set(
      idsRaw
        .map((x) => parseInt(String(x), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  )

  if (ids.length === 0) return NextResponse.json({ error: 'Tidak ada id' }, { status: 400 })
  if (ids.length > 500) return NextResponse.json({ error: 'Terlalu banyak id' }, { status: 400 })

  try {
    await Promise.all(ids.map((id) => deletePhotosForTicket(id).catch(() => {})))
    const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `WITH d AS (
         DELETE FROM "TroubleTicket"
         WHERE "id" = ANY($1::int[])
         RETURNING 1
       )
       SELECT COUNT(*)::int AS count FROM d;`,
      ids
    )
    return NextResponse.json({ ok: true, deleted: rows[0]?.count ?? 0 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to delete tickets' }, { status: 500 })
  }
}
