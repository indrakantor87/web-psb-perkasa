import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type TicketCategory = 'TT' | 'PV'
type ConfigRow = { id: number; category: TicketCategory; prefix: string; nextNumber: number }

async function ensureConfigTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicketIdConfigV2" (
      "id" INT NOT NULL,
      "category" TEXT NOT NULL,
      "prefix" TEXT NOT NULL,
      "nextNumber" INT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TroubleTicketIdConfigV2_pkey" PRIMARY KEY ("id","category")
    );
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicketIdConfigV2_cat_idx" ON "TroubleTicketIdConfigV2"("category");`)
  await prisma.$executeRawUnsafe(`
    INSERT INTO "TroubleTicketIdConfigV2" ("id","category","prefix","nextNumber","createdAt","updatedAt")
    SELECT "id",'TT',"prefix","nextNumber","createdAt","updatedAt"
    FROM "TroubleTicketIdConfig"
    ON CONFLICT ("id","category") DO NOTHING;
  `).catch(() => {})
}

function normalizeCategory(input: unknown): TicketCategory {
  const raw = String(input ?? '').trim().toUpperCase()
  if (raw === 'PV') return 'PV'
  return 'TT'
}

function defaultPrefixForCategory(category: TicketCategory) {
  return category === 'PV' ? 'PV/PKN/' : 'TT/PKN/'
}

function normalizePrefix(category: TicketCategory, input: unknown) {
  const raw = String(input ?? '').trim()
  if (!raw) return defaultPrefixForCategory(category)
  return raw.endsWith('/') ? raw : `${raw}/`
}

function normalizeNextNumber(input: unknown) {
  const n = Math.trunc(Number(input))
  if (!Number.isFinite(n) || n < 1) return 1
  if (n > 1_000_000_000) return 1_000_000_000
  return n
}

function periodKey(month: number, year: number) {
  return year * 100 + month
}

function getPeriodFromRequest(request: Request) {
  const { searchParams } = new URL(request.url)
  const monthRaw = Math.trunc(Number(searchParams.get('month')))
  const yearRaw = Math.trunc(Number(searchParams.get('year')))
  const category = normalizeCategory(searchParams.get('category'))
  const now = new Date()
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : (now.getMonth() + 1)
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : now.getFullYear()
  return { month, year, category }
}

async function getDefaultPrefix(category: TicketCategory) {
  const rows = await prisma.$queryRawUnsafe<Array<{ prefix: string }>>(
    `SELECT "prefix" FROM "TroubleTicketIdConfigV2" WHERE "category" = $1 ORDER BY "updatedAt" DESC LIMIT 1;`,
    category
  ).catch(() => [])
  return normalizePrefix(category, rows[0]?.prefix ?? defaultPrefixForCategory(category))
}

async function ensureDefaultRow(month: number, year: number, category: TicketCategory) {
  await ensureConfigTable()
  const id = periodKey(month, year)
  const prefix = await getDefaultPrefix(category)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TroubleTicketIdConfigV2" ("id","category","prefix","nextNumber") VALUES ($1,$2,$3,$4) ON CONFLICT ("id","category") DO NOTHING;`,
    id,
    category,
    prefix,
    1
  )

  const rows = await prisma.$queryRawUnsafe<Array<{ prefix: string; nextNumber: number }>>(
    `SELECT "prefix","nextNumber" FROM "TroubleTicketIdConfigV2" WHERE "id" = $1 AND "category" = $2 LIMIT 1;`,
    id,
    category
  ).catch(() => [])
  const current = rows[0]
  if (!current) return
  const currentPrefix = normalizePrefix(category, current.prefix)
  const maxRows = await prisma.$queryRawUnsafe<Array<{ max: number | null }>>(
    `SELECT MAX("ticketNumber")::int AS "max"
     FROM "TroubleTicket"
     WHERE "category" = $1 AND "ticketPrefix" = $2;`,
    category,
    currentPrefix
  ).catch(() => [])
  const maxTicketNumber = Math.trunc(Number(maxRows[0]?.max ?? 0))
  const desiredNext = Math.max(1, current.nextNumber, Number.isFinite(maxTicketNumber) ? maxTicketNumber + 1 : 1)
  if (desiredNext !== current.nextNumber || currentPrefix !== current.prefix) {
    await prisma.$executeRawUnsafe(
      `UPDATE "TroubleTicketIdConfigV2" SET "prefix" = $1, "nextNumber" = $2, "updatedAt" = NOW() WHERE "id" = $3 AND "category" = $4;`,
      currentPrefix,
      desiredNext,
      id,
      category
    )
  }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { month, year, category } = getPeriodFromRequest(request)
    await ensureDefaultRow(month, year, category)
    const id = periodKey(month, year)
    const rows = await prisma.$queryRawUnsafe<ConfigRow[]>(
      `SELECT "id","category","prefix","nextNumber" FROM "TroubleTicketIdConfigV2" WHERE "id" = $1 AND "category" = $2 LIMIT 1;`,
      id,
      category
    )
    const row = rows[0]
    return NextResponse.json(row ?? { id, category, prefix: defaultPrefixForCategory(category), nextNumber: 1 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to fetch ticket id config' }, { status: 500 })
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
    const { month, year, category } = getPeriodFromRequest(request)
    await ensureDefaultRow(month, year, category)
    const id = periodKey(month, year)
    const body = (await request.json().catch(() => ({}))) as { prefix?: unknown; nextNumber?: unknown }
    const prefix = normalizePrefix(category, body.prefix)
    const nextNumber = normalizeNextNumber(body.nextNumber)

    await prisma.$executeRawUnsafe(
      `UPDATE "TroubleTicketIdConfigV2" SET "prefix" = $1, "nextNumber" = $2, "updatedAt" = NOW() WHERE "id" = $3 AND "category" = $4;`,
      prefix,
      nextNumber,
      id,
      category
    )

    const rows = await prisma.$queryRawUnsafe<ConfigRow[]>(
      `SELECT "id","category","prefix","nextNumber" FROM "TroubleTicketIdConfigV2" WHERE "id" = $1 AND "category" = $2 LIMIT 1;`,
      id,
      category
    )
    return NextResponse.json(rows[0])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to update ticket id config' }, { status: 500 })
  }
}
