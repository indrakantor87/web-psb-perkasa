import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type Row = { id: number; type: string; durationDays: number }

async function ensureSlaTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicketSla" (
      "id" SERIAL NOT NULL,
      "type" TEXT NOT NULL,
      "durationDays" INT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TroubleTicketSla_pkey" PRIMARY KEY ("id")
    );
  `)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicketSla_type_key" ON "TroubleTicketSla"("type");`)
}

async function ensureDefaults() {
  await ensureSlaTable()
  const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "TroubleTicketSla";`).catch(() => [])
  const count = rows[0]?.count ?? 0
  if (count > 0) return

  const defaults = [
    { type: 'EMERGENCY', durationDays: 2 },
    { type: 'MAJOR', durationDays: 3 },
    { type: 'MINOR', durationDays: 5 },
  ]

  for (const d of defaults) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TroubleTicketSla" ("type","durationDays") VALUES ($1,$2) ON CONFLICT ("type") DO NOTHING;`,
      d.type,
      d.durationDays
    )
  }
}

function normalizeType(input: unknown) {
  return String(input ?? '').trim().toUpperCase().replace(/\s+/g, '_')
}

function normalizeDays(input: unknown) {
  const n = Math.trunc(Number(input))
  if (!Number.isFinite(n)) return null
  if (n < 1) return 1
  if (n > 30) return 30
  return n
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureDefaults()
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT "id","type","durationDays" FROM "TroubleTicketSla" ORDER BY "type" ASC;`
    )
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to fetch SLA' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const privileged = ['ADMIN', 'CS', 'NOC']
  if (!privileged.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await ensureDefaults()
    const body = (await request.json().catch(() => ({}))) as { items?: Array<{ type?: unknown; durationDays?: unknown }> }
    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 })

    for (const it of items) {
      const type = normalizeType(it.type)
      const durationDays = normalizeDays(it.durationDays)
      if (!type || durationDays === null) continue

      await prisma.$executeRawUnsafe(
        `
          INSERT INTO "TroubleTicketSla" ("type","durationDays","updatedAt")
          VALUES ($1,$2,NOW())
          ON CONFLICT ("type") DO UPDATE SET
            "durationDays" = EXCLUDED."durationDays",
            "updatedAt" = NOW();
        `,
        type,
        durationDays
      )
    }

    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT "id","type","durationDays" FROM "TroubleTicketSla" ORDER BY "type" ASC;`
    )
    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to update SLA' }, { status: 500 })
  }
}

