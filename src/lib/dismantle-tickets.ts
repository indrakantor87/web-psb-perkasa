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
  marketingOwners?: string[] | null
  page: number
  limit: number
}

type IsolationLinkCandidate = {
  id: number
  radboox?: unknown
  userEmail?: unknown
  customerPhone?: unknown
  customerName?: unknown
  customerAddress?: unknown
}

function normalizeEmail(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function buildIsolationMatchKey(candidate: {
  radboox?: unknown
  userEmail?: unknown
  customerPhone?: unknown
  customerName?: unknown
  customerAddress?: unknown
}) {
  const rad = String(candidate.radboox ?? '').trim()
  if (!rad) return ''

  const email = normalizeEmail(candidate.userEmail)
  if (email) return `rad:${rad}|email:${email}`

  const phone = normalizePhone(candidate.customerPhone)
  if (phone) return `rad:${rad}|phone:${phone}`

  const name = normalizeText(candidate.customerName)
  const address = normalizeText(candidate.customerAddress)
  if (name) return `rad:${rad}|name:${name}|addr:${address}`

  return ''
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
    baseWhereParts.push(`LOWER(TRIM(COALESCE("marketing", ''))) = ANY(${push(normalizedMarketingOwners)}::text[])`)
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

export async function getDismantleTicketLinksForIsolationItems(items: IsolationLinkCandidate[]) {
  if (items.length === 0) return new Set<number>()

  const ids = items
    .map((item) => Number(item.id))
    .filter((id) => Number.isFinite(id))
  const radbooxValues = Array.from(
    new Set(
      items
        .map((item) => String(item.radboox ?? '').trim())
        .filter(Boolean),
    ),
  )

  const sourceIdSet = ids.length > 0 ? await getDismantleTicketLinksForIsolationIds(ids) : new Set<number>()
  if (radbooxValues.length === 0) return sourceIdSet

  const ticketRows = await prisma.$queryRawUnsafe<
    Array<{
      sourceIsolationId: number | null
      radboox: string | null
      userEmail: string | null
      customerPhone: string | null
      customerName: string | null
      customerAddress: string | null
    }>
  >(
    `
      SELECT
        "sourceIsolationId",
        "radboox",
        "userEmail",
        "customerPhone",
        "customerName",
        "customerAddress"
      FROM "DismantleTickets"
      WHERE COALESCE("status", 'OPEN') = 'OPEN'
        AND COALESCE("radboox", '') = ANY($1::text[])
    `,
    radbooxValues,
  )

  const ticketKeySet = new Set(
    ticketRows
      .map((row) => buildIsolationMatchKey(row))
      .filter(Boolean),
  )

  const linked = new Set<number>(sourceIdSet)
  for (const item of items) {
    const id = Number(item.id)
    if (!Number.isFinite(id) || linked.has(id)) continue
    const key = buildIsolationMatchKey(item)
    if (key && ticketKeySet.has(key)) linked.add(id)
  }

  return linked
}

export async function relinkDismantleTicketsForIsolationItems(items: IsolationLinkCandidate[]) {
  if (items.length === 0) return 0

  const candidates = items.filter((item) => Number.isFinite(Number(item.id)))
  if (candidates.length === 0) return 0

  const radbooxValues = Array.from(
    new Set(
      candidates
        .map((item) => String(item.radboox ?? '').trim())
        .filter(Boolean),
    ),
  )
  if (radbooxValues.length === 0) return 0

  const candidateById = new Map<number, IsolationLinkCandidate>()
  const candidateByKey = new Map<string, IsolationLinkCandidate>()
  for (const item of candidates) {
    const id = Number(item.id)
    candidateById.set(id, item)
    const key = buildIsolationMatchKey(item)
    if (key && !candidateByKey.has(key)) {
      candidateByKey.set(key, item)
    }
  }

  const ticketRows = await prisma.$queryRawUnsafe<
    Array<{
      id: number
      sourceIsolationId: number | null
      radboox: string | null
      userEmail: string | null
      customerPhone: string | null
      customerName: string | null
      customerAddress: string | null
    }>
  >(
    `
      SELECT
        "id",
        "sourceIsolationId",
        "radboox",
        "userEmail",
        "customerPhone",
        "customerName",
        "customerAddress"
      FROM "DismantleTickets"
      WHERE COALESCE("status", 'OPEN') = 'OPEN'
        AND COALESCE("radboox", '') = ANY($1::text[])
    `,
    radbooxValues,
  )

  let updated = 0
  for (const ticket of ticketRows) {
    const sourceId = ticket.sourceIsolationId == null ? null : Number(ticket.sourceIsolationId)
    const directMatch = sourceId != null ? candidateById.get(sourceId) : undefined
    const identityKey = buildIsolationMatchKey(ticket)
    const identityMatch = identityKey ? candidateByKey.get(identityKey) : undefined
    const target = directMatch ?? identityMatch
    if (!target) continue

    const targetId = Number(target.id)
    if (!Number.isFinite(targetId) || sourceId === targetId) continue

    await prisma.$executeRawUnsafe(
      `UPDATE "DismantleTickets" SET "sourceIsolationId" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`,
      targetId,
      Number(ticket.id),
    )
    updated += 1
  }

  return updated
}
