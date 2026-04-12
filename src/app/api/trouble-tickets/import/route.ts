import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

type TroubleTicketDelegate = {
  create: (args: Record<string, unknown>) => Promise<unknown>
}

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
}

type IdCfg = { prefix: string; nextNumber: number }

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

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicketIdConfig_id_key" ON "TroubleTicketIdConfig"("id");`
  )
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
  await ensureIdConfig()
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
      const allocated = codeParsed ?? (await allocateTicketCode(periodMonth, periodYear))
      const customerName = String(r.customerName ?? '').trim()
      const user = String(r.user ?? '').trim()
      const waNumber = String(r.waNumber ?? '').trim()
      const type = String(r.type ?? '').trim()
      const mapsUrl = String(r.mapsUrl ?? '').trim()
      const notes = String(r.notes ?? '').trim()

      if (!customerName || !waNumber || !type) {
        failed += 1
        continue
      }

      const openedAt = parseDate(r.openedAt) ?? new Date()
      const closedAt = parseDate(r.closedAt)
      const statusRaw = String(r.status ?? '').trim().toUpperCase()
      const status = closedAt ? 'CLOSE' : statusRaw === 'CLOSE' ? 'CLOSE' : 'OPEN'

      const client = prisma as unknown as { troubleTicket: TroubleTicketDelegate }
      await client.troubleTicket.create({
        data: {
          ticketCode: allocated.ticketCode,
          ticketPrefix: allocated.ticketPrefix,
          ticketNumber: allocated.ticketNumber,
          periodMonth,
          periodYear,
          customerName,
          user: user || null,
          waNumber,
          type,
          mapsUrl: mapsUrl || null,
          notes: notes || null,
          openedAt,
          closedAt: status === 'CLOSE' ? (closedAt ?? new Date()) : null,
          status,
        },
      })
      success += 1
    } catch {
      failed += 1
    }
  }

  return NextResponse.json({ ok: true, success, failed })
}
