import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type ConfigRow = { id: number; prefix: string; nextNumber: number }

async function ensureConfigTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicketIdConfig" (
      "id" INT NOT NULL,
      "prefix" TEXT NOT NULL,
      "nextNumber" INT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TroubleTicketIdConfig_pkey" PRIMARY KEY ("id")
    );
  `)
}

function normalizePrefix(input: unknown) {
  const raw = String(input ?? '').trim()
  if (!raw) return 'TT/PKN/'
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
  const now = new Date()
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : (now.getMonth() + 1)
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : now.getFullYear()
  return { month, year }
}

async function getDefaultPrefix() {
  const rows = await prisma.$queryRawUnsafe<Array<{ prefix: string }>>(
    `SELECT "prefix" FROM "TroubleTicketIdConfig" ORDER BY "id" DESC LIMIT 1;`
  ).catch(() => [])
  return normalizePrefix(rows[0]?.prefix ?? 'TT/PKN/')
}

async function ensureDefaultRow(month: number, year: number) {
  await ensureConfigTable()
  const id = periodKey(month, year)
  const prefix = await getDefaultPrefix()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TroubleTicketIdConfig" ("id","prefix","nextNumber") VALUES ($1,$2,$3) ON CONFLICT ("id") DO NOTHING;`,
    id,
    prefix,
    1
  )
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { month, year } = getPeriodFromRequest(request)
    await ensureDefaultRow(month, year)
    const id = periodKey(month, year)
    const rows = await prisma.$queryRawUnsafe<ConfigRow[]>(
      `SELECT "id","prefix","nextNumber" FROM "TroubleTicketIdConfig" WHERE "id" = $1 LIMIT 1;`,
      id
    )
    const row = rows[0]
    return NextResponse.json(row ?? { id, prefix: 'TT/PKN/', nextNumber: 1 }, { headers: { 'Cache-Control': 'no-store' } })
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
    const { month, year } = getPeriodFromRequest(request)
    await ensureDefaultRow(month, year)
    const id = periodKey(month, year)
    const body = (await request.json().catch(() => ({}))) as { prefix?: unknown; nextNumber?: unknown }
    const prefix = normalizePrefix(body.prefix)
    const nextNumber = normalizeNextNumber(body.nextNumber)

    await prisma.$executeRawUnsafe(
      `UPDATE "TroubleTicketIdConfig" SET "prefix" = $1, "nextNumber" = $2, "updatedAt" = NOW() WHERE "id" = $3;`,
      prefix,
      nextNumber,
      id
    )

    const rows = await prisma.$queryRawUnsafe<ConfigRow[]>(
      `SELECT "id","prefix","nextNumber" FROM "TroubleTicketIdConfig" WHERE "id" = $1 LIMIT 1;`,
      id
    )
    return NextResponse.json(rows[0])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to update ticket id config' }, { status: 500 })
  }
}
