import { prisma } from '@/lib/prisma'

type GlobalState = {
  __ensureDismantleTicketsTablePromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

export type DismantleTicketStatus = 'OPEN' | 'CLOSED'

export type DismantleTicketRow = {
  id: number
  sourceIsolationId: number | null
  customerName: string
  customerAddress: string | null
  customerPhone: string | null
  userEmail: string | null
  marketing: string | null
  radboox: string | null
  isolationDate: Date | string
  reason: string | null
  fieldNote: string | null
  status: string
  ticketNumber: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export type DismantleTicketListParams = {
  search?: string | null
  radboox?: string | null
  ticketStatus?: 'ALL' | 'WITH' | 'WITHOUT'
  page: number
  limit: number
}

export async function ensureDismantleTicketsTable() {
  if (!g.__ensureDismantleTicketsTablePromise) {
    g.__ensureDismantleTicketsTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "DismantleTickets" (
          "id" SERIAL PRIMARY KEY,
          "sourceIsolationId" INTEGER,
          "customerName" TEXT NOT NULL,
          "customerAddress" TEXT,
          "customerPhone" TEXT,
          "userEmail" TEXT,
          "marketing" TEXT,
          "radboox" TEXT,
          "isolationDate" TIMESTAMP(3),
          "reason" TEXT,
          "fieldNote" TEXT,
          "status" TEXT NOT NULL DEFAULT 'OPEN',
          "ticketNumber" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)

      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "sourceIsolationId" INTEGER`).catch(
        () => {},
      )
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "customerAddress" TEXT`).catch(
        () => {},
      )
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "userEmail" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "marketing" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "radboox" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "isolationDate" TIMESTAMP(3)`).catch(
        () => {},
      )
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "reason" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "fieldNote" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "status" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "ticketNumber" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3)`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleTickets" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3)`).catch(() => {})

      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "DismantleTickets_sourceIsolationId_key" ON "DismantleTickets" ("sourceIsolationId") WHERE "sourceIsolationId" IS NOT NULL`,
      ).catch(() => {})
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DismantleTickets_status_idx" ON "DismantleTickets" ("status")`).catch(
        () => {},
      )
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DismantleTickets_ticketNumber_idx" ON "DismantleTickets" ("ticketNumber")`).catch(
        () => {},
      )

      await prisma.$executeRawUnsafe(`
        INSERT INTO "DismantleTickets" (
          "sourceIsolationId",
          "customerName",
          "customerAddress",
          "customerPhone",
          "userEmail",
          "marketing",
          "radboox",
          "isolationDate",
          "reason",
          "fieldNote",
          "status",
          "ticketNumber",
          "createdAt",
          "updatedAt"
        )
        SELECT
          i."id",
          i."customerName",
          i."customerAddress",
          i."customerPhone",
          i."userEmail",
          i."marketing",
          i."radboox",
          i."isolationDate",
          i."reason",
          NULL,
          'OPEN',
          NULLIF(TRIM(COALESCE(i."ticketDismantle", '')), ''),
          COALESCE(i."updatedAt", CURRENT_TIMESTAMP),
          COALESCE(i."updatedAt", CURRENT_TIMESTAMP)
        FROM "Isolation" i
        WHERE
          COALESCE(TRIM(COALESCE(i."ticketDismantle", '')), '') <> ''
          AND COALESCE(i."status", '') = 'OPEN'
          AND COALESCE(i."isArchived", false) = false
        ON CONFLICT ("sourceIsolationId") DO NOTHING
      `).catch(() => {})

      await prisma.$executeRawUnsafe(`
        UPDATE "Isolation"
        SET "ticketDismantle" = NULL
        WHERE
          COALESCE(TRIM(COALESCE("ticketDismantle", '')), '') <> ''
          AND COALESCE("status", '') = 'OPEN'
          AND COALESCE("isArchived", false) = false
          AND "id" IN (SELECT "sourceIsolationId" FROM "DismantleTickets" WHERE "sourceIsolationId" IS NOT NULL)
      `).catch(() => {})
    })().catch((error) => {
      g.__ensureDismantleTicketsTablePromise = undefined
      throw error
    })
  }

  await g.__ensureDismantleTicketsTablePromise
}

export function mapDismantleTicketRow(row: DismantleTicketRow) {
  return {
    id: Number(row.id),
    sourceIsolationId: row.sourceIsolationId == null ? null : Number(row.sourceIsolationId),
    customerName: row.customerName,
    customerAddress: row.customerAddress ?? null,
    customerPhone: row.customerPhone ?? null,
    userEmail: row.userEmail ?? null,
    marketing: row.marketing ?? null,
    radboox: row.radboox ?? null,
    isolationDate: row.isolationDate ? new Date(row.isolationDate).toISOString() : new Date().toISOString(),
    reason: row.reason ?? null,
    fieldNote: row.fieldNote ?? null,
    status: String(row.status ?? 'OPEN').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN',
    ticketDismantle: row.ticketNumber ?? null,
    ticketId: null,
    closeNote: null,
    closePhoto: null,
    closedAt: null,
    closedBy: null,
    ticket: null,
  }
}

export async function listDismantleTickets(params: DismantleTicketListParams) {
  const baseWhereParts: string[] = [`COALESCE("status", 'OPEN') = 'OPEN'`]
  const values: unknown[] = []
  const push = (value: unknown) => {
    values.push(value)
    return `$${values.length}`
  }

  if (params.search && params.search.trim() !== '') {
    const slot = push(`%${params.search.trim()}%`)
    baseWhereParts.push(`(
      "customerName" ILIKE ${slot}
      OR COALESCE("customerAddress", '') ILIKE ${slot}
      OR COALESCE("customerPhone", '') ILIKE ${slot}
      OR COALESCE("userEmail", '') ILIKE ${slot}
      OR COALESCE("marketing", '') ILIKE ${slot}
      OR COALESCE("ticketNumber", '') ILIKE ${slot}
    )`)
  }

  if (params.radboox && params.radboox !== 'ALL') {
    baseWhereParts.push(`COALESCE("radboox", '') = ${push(params.radboox)}`)
  }

  const whereParts = [...baseWhereParts]
  if (params.ticketStatus === 'WITH') {
    whereParts.push(`COALESCE(TRIM("ticketNumber"), '') <> ''`)
  } else if (params.ticketStatus === 'WITHOUT') {
    whereParts.push(`COALESCE(TRIM("ticketNumber"), '') = ''`)
  }

  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''
  const offset = Math.max(0, (params.page - 1) * params.limit)
  const limitSlot = push(params.limit)
  const offsetSlot = push(offset)

  const rows = await prisma.$queryRawUnsafe<DismantleTicketRow[]>(
    `
      SELECT
        "id",
        "sourceIsolationId",
        "customerName",
        "customerAddress",
        "customerPhone",
        "userEmail",
        "marketing",
        "radboox",
        "isolationDate",
        "reason",
        "fieldNote",
        "status",
        "ticketNumber",
        "createdAt",
        "updatedAt"
      FROM "DismantleTickets"
      ${whereSql}
      ORDER BY
        (COALESCE(TRIM("ticketNumber"), '') = '') ASC,
        COALESCE("updatedAt", "createdAt") DESC,
        "id" DESC
      LIMIT ${limitSlot}
      OFFSET ${offsetSlot}
    `,
    ...values,
  )

  const countRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `
      SELECT COUNT(*)::int AS count
      FROM "DismantleTickets"
      ${whereSql}
    `,
    ...values.slice(0, values.length - 2),
  )

  const total = Number(countRows[0]?.count ?? 0)

  const withWhereSql =
    [...baseWhereParts, `COALESCE(TRIM("ticketNumber"), '') <> ''`].length > 0
      ? `WHERE ${[...baseWhereParts, `COALESCE(TRIM("ticketNumber"), '') <> ''`].join(' AND ')}`
      : ''
  const withRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `
      SELECT COUNT(*)::int AS count
      FROM "DismantleTickets"
      ${withWhereSql}
    `,
    ...values.slice(0, values.length - 2),
  )

  const withoutWhereSql =
    [...baseWhereParts, `COALESCE(TRIM("ticketNumber"), '') = ''`].length > 0
      ? `WHERE ${[...baseWhereParts, `COALESCE(TRIM("ticketNumber"), '') = ''`].join(' AND ')}`
      : ''
  const withoutRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `
      SELECT COUNT(*)::int AS count
      FROM "DismantleTickets"
      ${withoutWhereSql}
    `,
    ...values.slice(0, values.length - 2),
  )
  const withTicketTotal = Number(withRows[0]?.count ?? 0)
  const withoutTicketTotal = Number(withoutRows[0]?.count ?? 0)

  return {
    items: rows.map(mapDismantleTicketRow),
    total,
    withTicketTotal,
    withoutTicketTotal,
  }
}

export async function getDismantleTicketById(id: number) {
  const rows = await prisma.$queryRawUnsafe<DismantleTicketRow[]>(
    `
      SELECT
        "id",
        "sourceIsolationId",
        "customerName",
        "customerAddress",
        "customerPhone",
        "userEmail",
        "marketing",
        "radboox",
        "isolationDate",
        "reason",
        "status",
        "ticketNumber",
        "createdAt",
        "updatedAt"
      FROM "DismantleTickets"
      WHERE "id" = $1
      LIMIT 1
    `,
    id,
  )
  return rows[0] ?? null
}

export async function getDismantleTicketLinksForIsolationIds(ids: number[]) {
  if (ids.length === 0) return new Set<number>()
  const rows = await prisma.$queryRawUnsafe<Array<{ sourceIsolationId: number }>>(
    `
      SELECT "sourceIsolationId"
      FROM "DismantleTickets"
      WHERE "sourceIsolationId" = ANY($1::int[])
        AND COALESCE("status", 'OPEN') = 'OPEN'
    `,
    ids,
  )
  return new Set(rows.map((row) => Number(row.sourceIsolationId)))
}
