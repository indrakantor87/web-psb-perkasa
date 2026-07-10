import { prisma } from '@/lib/prisma'

type GlobalState = {
  __ensureDismantleHistoryTablePromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

export type DismantleHistoryListParams = {
  search?: string | null
  radboox?: string | null
  ticketStatus?: 'ALL' | 'WITH' | 'WITHOUT'
  marketingOwners?: string[] | null
  page: number
  limit: number
}

export type DismantleHistoryRow = {
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
  ticketDismantle: string | null
  ticketId: number | null
  ticketLocationMap: string | null
  ticketDescription: string | null
  closeNote: string | null
  closePhoto: string | null
  closePhotos: string[] | null
  closedAt: Date | string | null
  closedBy: string | null
}

export async function ensureDismantleHistoryTable() {
  if (!g.__ensureDismantleHistoryTablePromise) {
    g.__ensureDismantleHistoryTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "DismantleHistory" (
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
          "ticketDismantle" TEXT,
          "ticketId" INTEGER,
          "ticketLocationMap" TEXT,
          "ticketDescription" TEXT,
          "closeNote" TEXT,
          "closePhoto" TEXT,
          "closePhotos" TEXT[],
          "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "closedBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "sourceIsolationId" INTEGER`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "customerAddress" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "userEmail" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "marketing" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "radboox" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "isolationDate" TIMESTAMP(3)`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "reason" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "ticketDismantle" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "ticketId" INTEGER`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "ticketLocationMap" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "ticketDescription" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "closeNote" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "closePhoto" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "closePhotos" TEXT[]`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3)`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "closedBy" TEXT`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`).catch(() => {})
      await prisma.$executeRawUnsafe(`ALTER TABLE "DismantleHistory" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`).catch(() => {})
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DismantleHistory_closedAt_idx" ON "DismantleHistory" ("closedAt")`).catch(() => {})
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DismantleHistory_sourceIsolationId_idx" ON "DismantleHistory" ("sourceIsolationId")`).catch(() => {})
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DismantleHistory_ticketDismantle_idx" ON "DismantleHistory" ("ticketDismantle")`).catch(() => {})
    })().catch((error) => {
      g.__ensureDismantleHistoryTablePromise = undefined
      throw error
    })
  }

  await g.__ensureDismantleHistoryTablePromise
}

export function mapDismantleHistoryRow(row: DismantleHistoryRow) {
  const photoList = Array.isArray(row.closePhotos)
    ? row.closePhotos.filter((item) => String(item ?? '').trim() !== '')
    : []
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
    status: 'CLOSED',
    ticketDismantle: row.ticketDismantle ?? null,
    ticketId: row.ticketId == null ? null : Number(row.ticketId),
    closeNote: row.closeNote ?? null,
    closePhoto: row.closePhoto ?? null,
    closePhotos: photoList.length > 0 ? photoList : (row.closePhoto ? [row.closePhoto] : []),
    closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : null,
    closedBy: row.closedBy ?? null,
    ticket: {
      locationMap: row.ticketLocationMap ?? null,
      description: row.ticketDescription ?? null,
    },
  }
}

export async function listDismantleHistory(params: DismantleHistoryListParams) {
  const whereParts: string[] = []
  const values: unknown[] = []
  const push = (value: unknown) => {
    values.push(value)
    return `$${values.length}`
  }

  const normalizedMarketingOwners = Array.isArray(params.marketingOwners)
    ? Array.from(
        new Set(
          params.marketingOwners
            .map((value) => String(value ?? '').trim().toLowerCase())
            .filter(Boolean),
        ),
      )
    : []

  if (normalizedMarketingOwners.length > 0) {
    whereParts.push(`LOWER(TRIM(COALESCE("marketing", ''))) = ANY(${push(normalizedMarketingOwners)}::text[])`)
  }

  if (params.search && params.search.trim() !== '') {
    const slot = push(`%${params.search.trim()}%`)
    whereParts.push(`(
      "customerName" ILIKE ${slot}
      OR COALESCE("customerAddress", '') ILIKE ${slot}
      OR COALESCE("customerPhone", '') ILIKE ${slot}
      OR COALESCE("userEmail", '') ILIKE ${slot}
      OR COALESCE("marketing", '') ILIKE ${slot}
      OR COALESCE("ticketDismantle", '') ILIKE ${slot}
      OR COALESCE("ticketDescription", '') ILIKE ${slot}
    )`)
  }

  if (params.radboox && params.radboox !== 'ALL') {
    whereParts.push(`COALESCE("radboox", '') = ${push(params.radboox)}`)
  }

  if (params.ticketStatus === 'WITH') {
    whereParts.push(`COALESCE(TRIM("ticketDismantle"), '') <> ''`)
  } else if (params.ticketStatus === 'WITHOUT') {
    whereParts.push(`COALESCE(TRIM("ticketDismantle"), '') = ''`)
  }

  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''
  const offset = Math.max(0, (params.page - 1) * params.limit)
  const limitSlot = push(params.limit)
  const offsetSlot = push(offset)

  const rows = await prisma.$queryRawUnsafe<DismantleHistoryRow[]>(
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
        "ticketDismantle",
        "ticketId",
        "ticketLocationMap",
        "ticketDescription",
        "closeNote",
        "closePhoto",
        "closePhotos",
        "closedAt",
        "closedBy"
      FROM "DismantleHistory"
      ${whereSql}
      ORDER BY
        (COALESCE(TRIM("ticketDismantle"), '') = '') ASC,
        NULLIF(regexp_replace(split_part(COALESCE("ticketDismantle", ''), '/', 3), '\\D', '', 'g'), '')::int ASC NULLS LAST,
        COALESCE("ticketDismantle", '') ASC,
        COALESCE("closedAt", "createdAt") DESC,
        "id" DESC
      LIMIT ${limitSlot}
      OFFSET ${offsetSlot}
    `,
    ...values,
  )

  const countRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `
      SELECT COUNT(*)::int AS count
      FROM "DismantleHistory"
      ${whereSql}
    `,
    ...values.slice(0, values.length - 2),
  )

  return {
    items: rows.map(mapDismantleHistoryRow),
    total: Number(countRows[0]?.count ?? 0),
  }
}

export async function getDismantleHistoryById(id: number) {
  const rows = await prisma.$queryRawUnsafe<DismantleHistoryRow[]>(
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
        "ticketDismantle",
        "ticketId",
        "ticketLocationMap",
        "ticketDescription",
        "closeNote",
        "closePhoto",
        "closePhotos",
        "closedAt",
        "closedBy"
      FROM "DismantleHistory"
      WHERE "id" = $1
      LIMIT 1
    `,
    id,
  )
  return rows[0] ?? null
}
