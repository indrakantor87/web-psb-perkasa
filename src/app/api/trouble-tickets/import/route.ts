import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

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
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "resolutionActions" TEXT[];`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicket_ticketCode_key" ON "TroubleTicket"("ticketCode");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_status_idx" ON "TroubleTicket"("status");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_openedAt_idx" ON "TroubleTicket"("openedAt");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_category_idx" ON "TroubleTicket"("category");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_problemCategory_idx" ON "TroubleTicket"("problemCategory");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_resolutionAction_idx" ON "TroubleTicket"("resolutionAction");`)
}

type TicketCategory = 'TT' | 'PV'
type IdCfg = { prefix: string; nextNumber: number }

function normalizeTypeKey(type: unknown) {
  return String(type ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
}

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

function formatTicketNumber(n: number) {
  return String(n).padStart(2, '0')
}

function periodKey(month: number, year: number) {
  return year * 100 + month
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
  await ensureIdConfig()
  const id = periodKey(month, year)
  const existing = await prisma.$queryRawUnsafe<IdCfg[]>(
    `SELECT "prefix","nextNumber" FROM "TroubleTicketIdConfigV2" WHERE "id" = $1 AND "category" = $2 LIMIT 1;`,
    id,
    category
  ).catch(() => [])
  const basePrefix = (() => {
    const p = existing[0]?.prefix
    if (p) return normalizePrefix(category, p)
    return defaultPrefixForCategory(category)
  })()
  if (!existing[0]) {
    const last = await prisma.$queryRawUnsafe<Array<{ prefix: string }>>(
      `SELECT "prefix" FROM "TroubleTicketIdConfigV2" WHERE "category" = $1 ORDER BY "updatedAt" DESC LIMIT 1;`,
      category
    ).catch(() => [])
    const prefix = normalizePrefix(category, last[0]?.prefix ?? basePrefix)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TroubleTicketIdConfigV2" ("id","category","prefix","nextNumber") VALUES ($1,$2,$3,$4) ON CONFLICT ("id","category") DO NOTHING;`,
      id,
      category,
      prefix,
      1
    )
  }

  const rowsAfter = await prisma.$queryRawUnsafe<IdCfg[]>(
    `SELECT "prefix","nextNumber" FROM "TroubleTicketIdConfigV2" WHERE "id" = $1 AND "category" = $2 LIMIT 1;`,
    id,
    category
  ).catch(() => [])
  const current = rowsAfter[0] ?? { prefix: basePrefix, nextNumber: 1 }
  const prefix = normalizePrefix(category, current.prefix)
  const maxRows = await prisma.$queryRawUnsafe<Array<{ max: number | null }>>(
    `SELECT MAX("ticketNumber")::int AS "max"
     FROM "TroubleTicket"
     WHERE "category" = $1 AND "ticketPrefix" = $2;`,
    category,
    prefix
  ).catch(() => [])
  const maxTicketNumber = Math.trunc(Number(maxRows[0]?.max ?? 0))
  const desiredNext = Math.max(1, current.nextNumber, Number.isFinite(maxTicketNumber) ? maxTicketNumber + 1 : 1)
  if (desiredNext !== current.nextNumber || prefix !== current.prefix) {
    await prisma.$executeRawUnsafe(
      `UPDATE "TroubleTicketIdConfigV2" SET "prefix" = $1, "nextNumber" = $2, "updatedAt" = NOW() WHERE "id" = $3 AND "category" = $4;`,
      prefix,
      desiredNext,
      id,
      category
    )
  }
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

async function bumpNextNumberIfNeeded(month: number, year: number, parsed: { category: TicketCategory; ticketPrefix: string; ticketNumber: number }) {
  await ensurePeriodIdRow(month, year, parsed.category)
  const id = periodKey(month, year)
  const rows = await prisma.$queryRawUnsafe<IdCfg[]>(
    `SELECT "prefix","nextNumber" FROM "TroubleTicketIdConfigV2" WHERE "id" = $1 AND "category" = $2 LIMIT 1;`,
    id,
    parsed.category
  ).catch(() => [])
  const current = rows[0]
  if (!current) return
  const currentPrefix = normalizePrefix(parsed.category, current.prefix)
  const parsedPrefix = normalizePrefix(parsed.category, parsed.ticketPrefix)
  if (currentPrefix !== parsedPrefix) return
  const desiredNext = Math.max(1, current.nextNumber, parsed.ticketNumber + 1)
  if (desiredNext !== current.nextNumber) {
    await prisma.$executeRawUnsafe(
      `UPDATE "TroubleTicketIdConfigV2" SET "nextNumber" = $1, "updatedAt" = NOW() WHERE "id" = $2 AND "category" = $3;`,
      desiredNext,
      id,
      parsed.category
    )
  }
}

function parseDate(v: unknown) {
  if (!v) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  if (!s) return null
  const parts = s.split(/[\/\-]/)
  if (parts.length === 3 && parts[0].length <= 2) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      const d = new Date(year, month, day)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['ADMIN', 'CS', 'NOC', 'TEKNISI', 'TROUBLESHOOTS'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureTroubleTicketTable().catch(() => {})

  const body = (await request.json().catch(() => ({}))) as {
    rows?: Array<{
      ticketCode?: unknown
      month?: unknown
      year?: unknown
      customerName?: unknown
      user?: unknown
      waNumber?: unknown
      mapsUrl?: unknown
      type?: unknown
      openedAt?: unknown
      closedAt?: unknown
      notes?: unknown
      problemCategory?: unknown
      resolutionAction?: unknown
      status?: unknown
    }>
  }

  const rows = Array.isArray(body.rows) ? body.rows : []
  if (rows.length === 0) return NextResponse.json({ error: 'No rows' }, { status: 400 })

  let success = 0
  let failed = 0

  for (const r of rows) {
    try {
      const month = Math.trunc(Number(r.month))
      const year = Math.trunc(Number(r.year))
      const now = new Date()
      const periodMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : (now.getMonth() + 1)
      const periodYear = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : now.getFullYear()
      const codeParsed = parseTicketCode(r.ticketCode)
      const category = codeParsed?.category ?? 'TT'
      if (codeParsed) {
        await bumpNextNumberIfNeeded(periodMonth, periodYear, codeParsed)
      }
      const allocated = codeParsed ?? (await allocateTicketCode(periodMonth, periodYear, category))
      const customerName = String(r.customerName ?? '').trim()
      const user = String(r.user ?? '').trim()
      const waNumberRaw = String(r.waNumber ?? '').trim()
      const waNumber = waNumberRaw || '-'
      const typeKey = normalizeTypeKey(r.type)
      const type = category === 'PV' ? 'PREVENTIVE' : typeKey
      const mapsUrl = String(r.mapsUrl ?? '').trim()
      const notes = String(r.notes ?? '').trim()
      const problemCategory = String(r.problemCategory ?? '').trim()
      const resolutionAction = String(r.resolutionAction ?? '').trim()

      if (!customerName || !type) {
        failed += 1
        continue
      }
      if (category === 'TT' && typeKey === 'PREVENTIVE') {
        failed += 1
        continue
      }

      const openedAtParsed = parseDate(r.openedAt)
      const closedAt = parseDate(r.closedAt)
      const statusRaw = String(r.status ?? '').trim().toUpperCase()
      const status = closedAt ? 'CLOSE' : statusRaw === 'CLOSE' ? 'CLOSE' : 'OPEN'

      const updateData: Record<string, unknown> = {
        ticketPrefix: allocated.ticketPrefix,
        ticketNumber: allocated.ticketNumber,
        category: allocated.category,
        periodMonth,
        periodYear,
        customerName,
        user: user || null,
        waNumber,
        mapsUrl: mapsUrl || null,
        type,
        notes: notes || null,
        problemCategory: problemCategory || null,
        resolutionAction: resolutionAction || null,
      }
      if (openedAtParsed) updateData.openedAt = openedAtParsed
      if (status === 'CLOSE') {
        updateData.status = 'CLOSE'
        updateData.closedAt = closedAt ?? new Date()
      }

      await prisma.troubleTicket.upsert({
        where: { ticketCode: allocated.ticketCode },
        create: {
          ticketCode: allocated.ticketCode,
          ticketPrefix: allocated.ticketPrefix,
          ticketNumber: allocated.ticketNumber,
          category: allocated.category,
          periodMonth,
          periodYear,
          customerName,
          user: user || null,
          waNumber,
          mapsUrl: mapsUrl || null,
          type,
          notes: notes || null,
          problemCategory: problemCategory || null,
          resolutionAction: resolutionAction || null,
          openedAt: openedAtParsed ?? new Date(),
          closedAt: status === 'CLOSE' ? (closedAt ?? new Date()) : null,
          status,
        },
        update: updateData as never,
      })
      success += 1
    } catch {
      failed += 1
    }
  }

  return NextResponse.json({ ok: true, success, failed })
}
