import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

type TroubleTicketDelegate = {
  update: (args: { where: { id: number }; data: Record<string, unknown> }) => Promise<unknown>
  delete: (args: { where: { id: number } }) => Promise<unknown>
}

let ensuredPromise: Promise<void> | null = null

async function ensureTroubleTicketTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicket" (
      "id" SERIAL NOT NULL,
      "ticketCode" TEXT,
      "ticketPrefix" TEXT,
      "ticketNumber" INT,
      "category" TEXT NOT NULL DEFAULT 'TT',
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

  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "user" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "ticketCode" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "ticketPrefix" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "ticketNumber" INT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "category" TEXT;`)
  await prisma.$executeRawUnsafe(`UPDATE "TroubleTicket" SET "category" = 'TT' WHERE "category" IS NULL;`).catch(() => {})
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closeNotes" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closePhotos" TEXT[];`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closeBy" TEXT;`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicket_ticketCode_key" ON "TroubleTicket"("ticketCode");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_status_idx" ON "TroubleTicket"("status");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_openedAt_idx" ON "TroubleTicket"("openedAt");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_closedAt_idx" ON "TroubleTicket"("closedAt");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_status_closedAt_idx" ON "TroubleTicket"("status","closedAt");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_category_idx" ON "TroubleTicket"("category");`)
}

async function ensureTroubleTicketTableOnce() {
  if (!ensuredPromise) {
    ensuredPromise = ensureTroubleTicketTable().catch((e) => {
      ensuredPromise = null
      throw e
    })
  }
  await ensuredPromise
}

function toInt(v: string) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI', 'TROUBLESHOOTS']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureTroubleTicketTableOnce().catch(() => {})

  const { id } = await params
  const ticketId = toInt(id)
  if (!ticketId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const { searchParams } = new URL(request.url)
    const includePhotos = (searchParams.get('includePhotos') ?? '').trim() === '1'
    const selectPhotos = includePhotos ? `"closePhotos",` : ''
    const sql = `SELECT "id","ticketCode","category","customerName","waNumber","mapsUrl","type","notes","closeNotes",${selectPhotos}COALESCE(array_length("closePhotos",1),0)::int AS "closePhotosCount","closeBy","status" FROM "TroubleTicket" WHERE "id" = $1 LIMIT 1;`
    const sqlFallback = `SELECT "id","ticketCode","category","customerName","waNumber","mapsUrl","type","notes","closeNotes",${selectPhotos}COALESCE(array_length("closePhotos",1),0)::int AS "closePhotosCount","closeBy","status"
           FROM "TroubleTicket"
           WHERE "ticketNumber" = $1
           ORDER BY "openedAt" DESC
           LIMIT 1;`
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number
        ticketCode: string | null
        category: string | null
        customerName: string
        waNumber: string
        mapsUrl: string | null
        type: string
        notes: string | null
        closeNotes: string | null
        closePhotos?: string[] | null
        closePhotosCount: number
        closeBy: string | null
        status: string
      }>
    >(
      sql,
      ticketId
    )
    const row =
      rows[0] ??
      (
        await prisma.$queryRawUnsafe<
          Array<{
            id: number
            ticketCode: string | null
            category: string | null
            customerName: string
            waNumber: string
            mapsUrl: string | null
            type: string
            notes: string | null
            closeNotes: string | null
            closePhotos?: string[] | null
            closePhotosCount: number
            closeBy: string | null
            status: string
          }>
        >(
          sqlFallback,
          ticketId
        )
      )[0]
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!includePhotos) {
      delete (row as Record<string, unknown>).closePhotos
    }
    return NextResponse.json(row)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to fetch ticket' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI', 'TROUBLESHOOTS']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureTroubleTicketTableOnce().catch(() => {})

  const { id } = await params
  const ticketId = toInt(id)
  if (!ticketId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const customerName = typeof body.customerName === 'undefined' ? undefined : String(body.customerName ?? '').trim()
  const user = typeof body.user === 'undefined' ? undefined : String(body.user ?? '').trim()
  const waNumber = typeof body.waNumber === 'undefined' ? undefined : String(body.waNumber ?? '').trim()
  const mapsUrl = typeof body.mapsUrl === 'undefined' ? undefined : String(body.mapsUrl ?? '').trim()
  const type = typeof body.type === 'undefined' ? undefined : String(body.type ?? '').trim()
  const notes = typeof body.notes === 'undefined' ? undefined : String(body.notes ?? '').trim()
  const statusRaw = typeof body.status === 'undefined' ? undefined : String(body.status ?? '').trim().toUpperCase()

  if (customerName !== undefined && !customerName) return NextResponse.json({ error: 'Nama pelanggan wajib' }, { status: 400 })
  if (waNumber !== undefined && !waNumber) return NextResponse.json({ error: 'No WA wajib' }, { status: 400 })
  if (type !== undefined && !type) return NextResponse.json({ error: 'Type wajib' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (customerName !== undefined) data.customerName = customerName
  if (user !== undefined) data.user = user || null
  if (waNumber !== undefined) data.waNumber = waNumber
  if (mapsUrl !== undefined) data.mapsUrl = mapsUrl || null
  if (type !== undefined) data.type = type
  if (notes !== undefined) data.notes = notes || null

  if (statusRaw !== undefined) {
    if (!['OPEN', 'CLOSE'].includes(statusRaw)) return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    if (statusRaw === 'CLOSE') {
      return NextResponse.json({ error: 'Untuk CLOSE wajib isi Penanganan dan upload foto. Gunakan menu Close.' }, { status: 400 })
    }
    data.status = statusRaw
    data.closedAt = null
  }

  try {
    const client = prisma as unknown as { troubleTicket: TroubleTicketDelegate }
    const updated = await client.troubleTicket.update({
      where: { id: ticketId },
      data,
    })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to update ticket' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI', 'TROUBLESHOOTS']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureTroubleTicketTableOnce().catch(() => {})

  const { id } = await params
  const ticketId = toInt(id)
  if (!ticketId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const client = prisma as unknown as { troubleTicket: TroubleTicketDelegate }
    await client.troubleTicket.delete({ where: { id: ticketId } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to delete ticket' }, { status: 500 })
  }
}
