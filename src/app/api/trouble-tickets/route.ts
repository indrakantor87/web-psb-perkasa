import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

type TroubleTicketDelegate = {
  updateMany: (args: Record<string, unknown>) => Promise<unknown>
  findMany: (args: Record<string, unknown>) => Promise<unknown>
  create: (args: Record<string, unknown>) => Promise<unknown>
}

let ensuredPromise: Promise<void> | null = null

async function ensureTroubleTicketTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicket" (
      "id" SERIAL NOT NULL,
      "ticketCode" TEXT,
      "ticketPrefix" TEXT,
      "ticketNumber" INT,
      "periodMonth" INT,
      "periodYear" INT,
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
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "periodMonth" INT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "periodYear" INT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closeNotes" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closePhotos" TEXT[];`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closeBy" TEXT;`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicket_ticketCode_key" ON "TroubleTicket"("ticketCode");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_status_idx" ON "TroubleTicket"("status");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_openedAt_idx" ON "TroubleTicket"("openedAt");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_period_idx" ON "TroubleTicket"("periodYear","periodMonth");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_ticketNumber_idx" ON "TroubleTicket"("ticketNumber");`)
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

type IdCfg = { prefix: string; nextNumber: number }

let ensuredIdConfigPromise: Promise<void> | null = null

async function ensureIdConfig() {
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

  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicketIdConfig_id_key" ON "TroubleTicketIdConfig"("id");`)
}

async function ensureIdConfigOnce() {
  if (!ensuredIdConfigPromise) {
    ensuredIdConfigPromise = ensureIdConfig().catch((e) => {
      ensuredIdConfigPromise = null
      throw e
    })
  }
  await ensuredIdConfigPromise
}

function normalizePrefix(input: unknown) {
  const raw = String(input ?? '').trim()
  if (!raw) return 'TT/PKN/'
  return raw.endsWith('/') ? raw : `${raw}/`
}

function formatTicketNumber(n: number) {
  return String(n).padStart(2, '0')
}

function periodKey(month: number, year: number) {
  return year * 100 + month
}

function parseMonthYear(params: URLSearchParams) {
  const monthRaw = Math.trunc(Number(params.get('month')))
  const yearRaw = Math.trunc(Number(params.get('year')))
  const now = new Date()
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : (now.getMonth() + 1)
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : now.getFullYear()
  return { month, year }
}

function parseTicketCode(input: unknown) {
  const raw = String(input ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^(.*\/)(\d+)\s*$/)
  if (!m) return null
  const prefix = normalizePrefix(m[1])
  const n = Math.trunc(Number(m[2]))
  if (!Number.isFinite(n) || n < 1) return null
  return { ticketPrefix: prefix, ticketNumber: n, ticketCode: `${prefix}${formatTicketNumber(n)}` }
}

async function ensurePeriodIdRow(month: number, year: number) {
  await ensureIdConfigOnce()
  const id = periodKey(month, year)
  const last = await prisma.$queryRawUnsafe<Array<{ prefix: string }>>(
    `SELECT "prefix" FROM "TroubleTicketIdConfig" ORDER BY "id" DESC LIMIT 1;`
  ).catch(() => [])
  const prefix = normalizePrefix(last[0]?.prefix ?? 'TT/PKN/')
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TroubleTicketIdConfig" ("id","prefix","nextNumber") VALUES ($1,$2,$3) ON CONFLICT ("id") DO NOTHING;`,
    id,
    prefix,
    1
  )
}

async function allocateTicketCode(month: number, year: number) {
  await ensurePeriodIdRow(month, year)
  const id = periodKey(month, year)
  const rows = await prisma.$queryRawUnsafe<IdCfg[]>(
    `SELECT "prefix","nextNumber" FROM "TroubleTicketIdConfig" WHERE "id" = $1 LIMIT 1;`,
    id
  )
  const current = rows[0] ?? { prefix: 'TT/PKN/', nextNumber: 1 }
  const prefix = normalizePrefix(current.prefix)
  const updated = await prisma.$queryRawUnsafe<IdCfg[]>(
    `UPDATE "TroubleTicketIdConfig" SET "nextNumber" = "nextNumber" + 1, "updatedAt" = NOW(), "prefix" = $2 WHERE "id" = $1 RETURNING "prefix","nextNumber";`,
    id,
    prefix
  )
  const next = updated[0]?.nextNumber ?? (current.nextNumber + 1)
  const ticketNumber = Math.max(1, next - 1)
  return { ticketPrefix: prefix, ticketNumber, ticketCode: `${prefix}${formatTicketNumber(ticketNumber)}` }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureTroubleTicketTableOnce()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'DB init failed' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const search = (searchParams.get('search') ?? '').trim()
  const status = (searchParams.get('status') ?? 'ALL').trim().toUpperCase()
  const { month, year } = parseMonthYear(searchParams)
  const roleUpper = (session.user.role || '').toUpperCase()

  if (roleUpper !== 'TROUBLESHOOTS') {
    try {
      const client = prisma as unknown as { troubleTicket: TroubleTicketDelegate }
      await client.troubleTicket.updateMany({
        where: {
          status: 'OPEN',
          OR: [
            { periodYear: null },
            { periodMonth: null },
            { periodYear: { lt: year } },
            { AND: [{ periodYear: year }, { periodMonth: { lt: month } }] },
          ],
        },
        data: { periodMonth: month, periodYear: year },
      })
    } catch {}
  }

  const where: Record<string, unknown> = {}

  if (roleUpper === 'TROUBLESHOOTS') {
    where.status = 'OPEN'
  } else if (status && status !== 'ALL') {
    where.status = status
  }
  if (roleUpper !== 'TROUBLESHOOTS') {
    where.periodMonth = month
    where.periodYear = year
  }

  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { user: { contains: search, mode: 'insensitive' } },
      { waNumber: { contains: search, mode: 'insensitive' } },
      { type: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ]
  }

  try {
    const client = prisma as unknown as { troubleTicket: TroubleTicketDelegate }
    const limitParam = Math.trunc(Number(searchParams.get('limit')))
    const take = roleUpper === 'TROUBLESHOOTS'
      ? (Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 500 ? limitParam : 200)
      : undefined
    const rows = await client.troubleTicket.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      ...(take ? { take } : {}),
    })
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to fetch trouble tickets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['ADMIN', 'CS', 'NOC', 'TEKNISI', 'TROUBLESHOOTS'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await ensureTroubleTicketTableOnce()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'DB init failed' }, { status: 500 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const ticketCodeInput = body.ticketCode
  const month = Math.trunc(Number(body.month))
  const year = Math.trunc(Number(body.year))
  const now = new Date()
  const periodMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : (now.getMonth() + 1)
  const periodYear = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : now.getFullYear()
  const customerName = String(body.customerName ?? '').trim()
  const user = String(body.user ?? '').trim()
  const waNumber = String(body.waNumber ?? '').trim()
  const mapsUrlRaw = String(body.mapsUrl ?? '').trim()
  const type = String(body.type ?? '').trim()
  const notes = String(body.notes ?? '').trim()

  if (!customerName || !waNumber || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const parsed = parseTicketCode(ticketCodeInput)
    const allocated = parsed ?? (await allocateTicketCode(periodMonth, periodYear))
    const client = prisma as unknown as { troubleTicket: TroubleTicketDelegate }
    const row = await client.troubleTicket.create({
      data: {
        ticketCode: allocated.ticketCode,
        ticketPrefix: allocated.ticketPrefix,
        ticketNumber: allocated.ticketNumber,
        periodMonth,
        periodYear,
        customerName,
        user: user || null,
        waNumber,
        mapsUrl: mapsUrlRaw || null,
        type,
        notes: notes || null,
        status: 'OPEN',
        openedAt: new Date(),
      },
    })
    return NextResponse.json(row)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to create trouble ticket' }, { status: 500 })
  }
}
