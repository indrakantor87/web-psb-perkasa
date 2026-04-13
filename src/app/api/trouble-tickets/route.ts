import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensurePhotoTableOnce } from '@/lib/trouble-ticket-photo-store'

export const runtime = 'nodejs'

let ensuredPromise: Promise<void> | null = null

async function ensureTroubleTicketTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicket" (
      "id" SERIAL NOT NULL,
      "ticketCode" TEXT,
      "ticketPrefix" TEXT,
      "ticketNumber" INT,
      "category" TEXT NOT NULL DEFAULT 'TT',
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
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "category" TEXT;`)
  await prisma.$executeRawUnsafe(`UPDATE "TroubleTicket" SET "category" = 'TT' WHERE "category" IS NULL;`).catch(() => {})
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "periodMonth" INT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "periodYear" INT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closeNotes" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closePhotos" TEXT[];`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closeBy" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "problemCategory" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "resolutionAction" TEXT;`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicket_ticketCode_key" ON "TroubleTicket"("ticketCode");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_status_idx" ON "TroubleTicket"("status");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_openedAt_idx" ON "TroubleTicket"("openedAt");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_closedAt_idx" ON "TroubleTicket"("closedAt");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_status_closedAt_idx" ON "TroubleTicket"("status","closedAt");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_period_idx" ON "TroubleTicket"("periodYear","periodMonth");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_ticketNumber_idx" ON "TroubleTicket"("ticketNumber");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_category_idx" ON "TroubleTicket"("category");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_problemCategory_idx" ON "TroubleTicket"("problemCategory");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_resolutionAction_idx" ON "TroubleTicket"("resolutionAction");`)
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

type TicketCategory = 'TT' | 'PV'
type IdCfg = { prefix: string; nextNumber: number }

let ensuredIdConfigPromise: Promise<void> | null = null

async function ensureIdConfig() {
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

async function ensureIdConfigOnce() {
  if (!ensuredIdConfigPromise) {
    ensuredIdConfigPromise = ensureIdConfig().catch((e) => {
      ensuredIdConfigPromise = null
      throw e
    })
  }
  await ensuredIdConfigPromise
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

function normalizeTypeKey(type: unknown) {
  return String(type ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
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
  const cat = String(m[1]).trim().toUpperCase().startsWith('PV/') ? 'PV' : 'TT'
  const category = normalizeCategory(cat)
  const prefix = normalizePrefix(category, m[1])
  const n = Math.trunc(Number(m[2]))
  if (!Number.isFinite(n) || n < 1) return null
  return { category, ticketPrefix: prefix, ticketNumber: n, ticketCode: `${prefix}${formatTicketNumber(n)}` }
}

async function ensurePeriodIdRow(month: number, year: number, category: TicketCategory) {
  await ensureIdConfigOnce()
  const id = periodKey(month, year)
  const last = await prisma.$queryRawUnsafe<Array<{ prefix: string }>>(
    `SELECT "prefix" FROM "TroubleTicketIdConfigV2" WHERE "category" = $1 ORDER BY "updatedAt" DESC LIMIT 1;`,
    category
  ).catch(() => [])
  const prefix = normalizePrefix(category, last[0]?.prefix ?? defaultPrefixForCategory(category))
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TroubleTicketIdConfigV2" ("id","category","prefix","nextNumber") VALUES ($1,$2,$3,$4) ON CONFLICT ("id","category") DO NOTHING;`,
    id,
    category,
    prefix,
    1
  )
}

async function allocateTicketCode(month: number, year: number, category: TicketCategory) {
  await ensurePeriodIdRow(month, year, category)
  const id = periodKey(month, year)
  const rows = await prisma.$queryRawUnsafe<IdCfg[]>(
    `SELECT "prefix","nextNumber" FROM "TroubleTicketIdConfigV2" WHERE "id" = $1 AND "category" = $2 LIMIT 1;`,
    id,
    category
  )
  const current = rows[0] ?? { prefix: defaultPrefixForCategory(category), nextNumber: 1 }
  const prefix = normalizePrefix(category, current.prefix)
  const updated = await prisma.$queryRawUnsafe<IdCfg[]>(
    `UPDATE "TroubleTicketIdConfigV2" SET "nextNumber" = "nextNumber" + 1, "updatedAt" = NOW(), "prefix" = $3 WHERE "id" = $1 AND "category" = $2 RETURNING "prefix","nextNumber";`,
    id,
    category,
    prefix
  )
  const next = updated[0]?.nextNumber ?? (current.nextNumber + 1)
  const ticketNumber = Math.max(1, next - 1)
  return { category, ticketPrefix: prefix, ticketNumber, ticketCode: `${prefix}${formatTicketNumber(ticketNumber)}` }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureTroubleTicketTableOnce()
    await ensurePhotoTableOnce()
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
      await prisma.$executeRawUnsafe(
        `UPDATE "TroubleTicket"
         SET "periodMonth" = $1, "periodYear" = $2
         WHERE "status" = 'OPEN'
           AND (
             "periodYear" IS NULL
             OR "periodMonth" IS NULL
             OR "periodYear" < $2
             OR ("periodYear" = $2 AND "periodMonth" < $1)
           );`,
        month,
        year
      )
    } catch {}
  }

  try {
    const limitParam = Math.trunc(Number(searchParams.get('limit')))

    const statusFilter =
      roleUpper === 'TROUBLESHOOTS'
        ? (status === 'OPEN' || status === 'CLOSE') ? status : 'OPEN'
        : (status && status !== 'ALL') ? status : null

    const whereParts: string[] = []
    const params: unknown[] = []

    if (statusFilter) {
      params.push(statusFilter)
      whereParts.push(`"status" = $${params.length}`)
    }

    if (roleUpper !== 'TROUBLESHOOTS') {
      params.push(month)
      whereParts.push(`"periodMonth" = $${params.length}`)
      params.push(year)
      whereParts.push(`"periodYear" = $${params.length}`)
    }

    if (search) {
      params.push(`%${search}%`)
      const p = `$${params.length}`
      whereParts.push(
        `("customerName" ILIKE ${p} OR "user" ILIKE ${p} OR "waNumber" ILIKE ${p} OR "type" ILIKE ${p} OR "notes" ILIKE ${p} OR "ticketCode" ILIKE ${p} OR "problemCategory" ILIKE ${p} OR "resolutionAction" ILIKE ${p})`
      )
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    const take =
      roleUpper === 'TROUBLESHOOTS'
        ? Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 500
          ? limitParam
          : (statusFilter === 'CLOSE' ? 120 : 200)
        : null

    const orderSql =
      roleUpper === 'TROUBLESHOOTS' && statusFilter === 'CLOSE'
        ? `"closedAt" DESC NULLS LAST, "openedAt" DESC`
        : `"openedAt" DESC`

    const limitSql = take ? `LIMIT ${take}` : ''

    const sql = `
      SELECT
        "id",
        "ticketCode",
        "ticketPrefix",
        "ticketNumber",
        "category",
        "periodMonth",
        "periodYear",
        "customerName",
        "user",
        "waNumber",
        "mapsUrl",
        "type",
        "openedAt",
        "closedAt",
        "notes",
        "closeBy",
        "problemCategory",
        "resolutionAction",
        (
          COALESCE((SELECT COUNT(*) FROM "TroubleTicketPhoto" p WHERE p."ticketId" = "TroubleTicket"."id"), 0)
          + COALESCE(array_length("closePhotos", 1), 0)
        )::int AS "closePhotosCount",
        "status"
      FROM "TroubleTicket"
      ${whereSql}
      ORDER BY ${orderSql}
      ${limitSql};
    `

    const rows = await prisma.$queryRawUnsafe<unknown[]>(sql, ...params)
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
  const problemCategory = String(body.problemCategory ?? '').trim()
  const requestedCategory = normalizeCategory(body.category)

  if (!customerName || !waNumber || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const parsed = parseTicketCode(ticketCodeInput)
    const category = parsed?.category ?? requestedCategory
    const typeKey = normalizeTypeKey(type)
    if (category === 'PV' && typeKey !== 'PREVENTIVE') {
      return NextResponse.json({ error: 'Untuk kategori Preventive (PV), type wajib PREVENTIVE' }, { status: 400 })
    }
    if (category === 'TT' && typeKey === 'PREVENTIVE') {
      return NextResponse.json({ error: 'Untuk kategori Trouble Ticket (TT), type tidak boleh PREVENTIVE' }, { status: 400 })
    }
    if (category === 'TT' && !problemCategory) {
      return NextResponse.json({ error: 'Jenis gangguan wajib dipilih untuk Trouble Ticket (TT)' }, { status: 400 })
    }
    const allocated = parsed ?? (await allocateTicketCode(periodMonth, periodYear, category))
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number
        ticketCode: string | null
        ticketPrefix: string | null
        ticketNumber: number | null
        category: string
        periodMonth: number | null
        periodYear: number | null
        customerName: string
        user: string | null
        waNumber: string
        mapsUrl: string | null
        type: string
        openedAt: string
        closedAt: string | null
        notes: string | null
        closeBy: string | null
        status: string
      }>
    >(
      `INSERT INTO "TroubleTicket" (
         "ticketCode","ticketPrefix","ticketNumber","category",
         "periodMonth","periodYear",
         "customerName","user","waNumber","mapsUrl","type","notes",
         "problemCategory","resolutionAction",
         "status","openedAt"
       )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'OPEN',NOW())
       RETURNING
         "id","ticketCode","ticketPrefix","ticketNumber","category",
         "periodMonth","periodYear","customerName","user","waNumber","mapsUrl",
       "type","openedAt","closedAt","notes","closeBy","problemCategory","resolutionAction","status";`,
      allocated.ticketCode,
      allocated.ticketPrefix,
      allocated.ticketNumber,
      allocated.category,
      periodMonth,
      periodYear,
      customerName,
      user || null,
      waNumber,
      mapsUrlRaw || null,
      typeKey,
      notes || null,
      problemCategory || null,
      null
    )
    const row = rows[0]
    if (!row) return NextResponse.json({ error: 'Failed to create trouble ticket' }, { status: 500 })
    return NextResponse.json(row)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to create trouble ticket' }, { status: 500 })
  }
}
