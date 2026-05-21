import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensurePhotoTableOnce } from '@/lib/trouble-ticket-photo-store'
import { cache } from '@/lib/cache'
import crypto from 'node:crypto'

export const runtime = 'nodejs'

let ensuredPromise: Promise<void> | null = null
let ensuredSlaPromise: Promise<void> | null = null

async function listPushTokensForRoles(roles: string[]) {
  if (!Array.isArray(roles) || roles.length === 0) return []
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ token: string }>>(
      `SELECT "token"
       FROM "DevicePushToken"
       WHERE "token" IS NOT NULL
         AND COALESCE("userRole",'') <> ''
         AND "userRole" = ANY($1::text[])
       ORDER BY "lastSeenAt" DESC
       LIMIT 5000;`,
      roles
    )
    return rows.map((r) => String(r.token ?? '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

type FcmAccess = { token: string; exp: number }
let cachedFcmAccess: FcmAccess | null = null

function readFcmServiceAccountEnv() {
  const projectId = String(process.env.FCM_PROJECT_ID ?? '').trim()
  const clientEmail = String(process.env.FCM_CLIENT_EMAIL ?? '').trim()
  let privateKeyRaw = String(process.env.FCM_PRIVATE_KEY ?? '').trim()
  if (privateKeyRaw.startsWith('"') && privateKeyRaw.endsWith('"')) privateKeyRaw = privateKeyRaw.slice(1, -1)
  let privateKey = privateKeyRaw.includes('\\n') ? privateKeyRaw.replace(/\\n/g, '\n') : privateKeyRaw
  privateKey = privateKey.replace(/\r\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) return null
  try {
    crypto.createPrivateKey({ key: privateKey, format: 'pem', type: 'pkcs8' })
  } catch {
    return null
  }
  return { projectId, clientEmail, privateKey }
}

function base64Url(input: string) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signJwtRs256(payload: Record<string, unknown>, privateKey: string) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const encHeader = base64Url(JSON.stringify(header))
  const encPayload = base64Url(JSON.stringify(payload))
  const data = `${encHeader}.${encPayload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(data)
  signer.end()
  const signature = signer.sign(privateKey)
  const encSignature = signature.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${data}.${encSignature}`
}

async function getFcmAccessToken() {
  const sa = readFcmServiceAccountEnv()
  if (!sa) return null
  const now = Math.floor(Date.now() / 1000)
  if (cachedFcmAccess && cachedFcmAccess.exp - 60 > now) return cachedFcmAccess.token

  const assertion = signJwtRs256(
    {
      iss: sa.clientEmail,
      sub: sa.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.privateKey
  )

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  }).catch(() => null)
  const json = (await res?.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null
  const token = String(json?.access_token ?? '').trim()
  const expiresIn = Math.trunc(Number(json?.expires_in ?? 3600))
  if (!res?.ok || !token) return null
  cachedFcmAccess = { token, exp: now + Math.max(60, expiresIn) }
  return token
}

async function sendFcmV1(tokens: string[], payload: { title: string; body: string; data?: Record<string, unknown> }) {
  const sa = readFcmServiceAccountEnv()
  if (!sa) return
  const cleaned = Array.from(new Set(tokens.map((t) => String(t ?? '').trim()).filter(Boolean))).slice(0, 500)
  if (cleaned.length === 0) return
  const accessToken = await getFcmAccessToken()
  if (!accessToken) return

  for (const token of cleaned) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.projectId)}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data: Object.fromEntries(Object.entries(payload.data ?? {}).map(([k, v]) => [k, String(v ?? '')])),
          android: {
            priority: 'HIGH',
            notification: {
              channel_id: 'trouble_tickets',
              default_sound: true,
              default_vibrate_timings: true,
            },
          },
        },
      }),
    }).catch(() => null)

    if (!res) continue
    if (res.ok) continue

    const text = await res.text().catch(() => '')
    const lower = String(text ?? '').toLowerCase()
    if (lower.includes('unregistered') || lower.includes('registration-token-not-registered')) {
      await prisma.$executeRawUnsafe(`DELETE FROM "DevicePushToken" WHERE "token" = $1;`, token).catch(() => {})
    }
  }
}

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

async function ensureSlaTableOnce() {
  if (!ensuredSlaPromise) {
    ensuredSlaPromise = ensureSlaTable().catch((e) => {
      ensuredSlaPromise = null
      throw e
    })
  }
  await ensuredSlaPromise
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

function stripPeriodSuffix(prefix: string) {
  return String(prefix ?? '').replace(/\/\d{2}\.\d{4}\/$/, '/')
}

function formatMonth2(month: number) {
  return String(month).padStart(2, '0')
}

function ensurePeriodPrefix(category: TicketCategory, input: unknown, month: number, year: number) {
  const base = stripPeriodSuffix(normalizePrefix(category, input))
  return `${base}${formatMonth2(month)}.${year}/`
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
  const existing = await prisma.$queryRawUnsafe<IdCfg[]>(
    `SELECT "prefix","nextNumber" FROM "TroubleTicketIdConfigV2" WHERE "id" = $1 AND "category" = $2 LIMIT 1;`,
    id,
    category
  ).catch(() => [])

  if (!existing[0]) {
    const last = await prisma.$queryRawUnsafe<Array<{ prefix: string }>>(
      `SELECT "prefix" FROM "TroubleTicketIdConfigV2" WHERE "category" = $1 ORDER BY "updatedAt" DESC LIMIT 1;`,
      category
    ).catch(() => [])
    const basePrefix = stripPeriodSuffix(normalizePrefix(category, last[0]?.prefix ?? defaultPrefixForCategory(category)))
    const prefix = ensurePeriodPrefix(category, basePrefix, month, year)
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
  const current = rowsAfter[0]
  if (!current) return
  const prefix = ensurePeriodPrefix(category, current.prefix, month, year)
  const maxRows = await prisma.$queryRawUnsafe<Array<{ max: number | null }>>(
    `SELECT MAX("ticketNumber")::int AS "max"
     FROM "TroubleTicket"
     WHERE "periodMonth" = $1 AND "periodYear" = $2 AND "category" = $3 AND "ticketPrefix" = $4;`,
    month,
    year,
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
  const prefix = ensurePeriodPrefix(category, current.prefix, month, year)
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
    await ensureSlaTableOnce()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'DB init failed' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const search = (searchParams.get('search') ?? '').trim()
  const status = (searchParams.get('status') ?? 'ALL').trim().toUpperCase()
  const overdueOnly = (searchParams.get('overdue') ?? '') === '1'
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
    const pageParam = Math.trunc(Number(searchParams.get('page')))

    const statusFilter =
      roleUpper === 'TROUBLESHOOTS'
        ? (status === 'OPEN' || status === 'CLOSE') ? status : 'OPEN'
        : (status && status !== 'ALL') ? status : null

    const baseParts: string[] = []
    const baseParams: unknown[] = []

    if (roleUpper !== 'TROUBLESHOOTS') {
      baseParams.push(month)
      baseParts.push(`"periodMonth" = $${baseParams.length}`)
      baseParams.push(year)
      baseParts.push(`"periodYear" = $${baseParams.length}`)
    }

    if (search) {
      baseParams.push(`%${search}%`)
      const p = `$${baseParams.length}`
      baseParts.push(
        `("customerName" ILIKE ${p} OR "user" ILIKE ${p} OR "waNumber" ILIKE ${p} OR "type" ILIKE ${p} OR "notes" ILIKE ${p} OR "ticketCode" ILIKE ${p} OR "problemCategory" ILIKE ${p} OR "resolutionAction" ILIKE ${p})`
      )
    }

    const whereParts: string[] = [...baseParts]
    const params: unknown[] = [...baseParams]

    if (statusFilter) {
      params.push(statusFilter)
      whereParts.push(`"status" = $${params.length}`)
    }

    const useSlaJoin = roleUpper !== 'TROUBLESHOOTS' && overdueOnly
    if (useSlaJoin) {
      whereParts.push(`NOW() - "openedAt" > (COALESCE(s."durationDays", 1) * INTERVAL '1 day')`)
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
    const summaryWhereSql = baseParts.length ? `WHERE ${baseParts.join(' AND ')}` : ''

    const allowedPageSizes = new Set([25, 50, 100])
    const pageSize =
      roleUpper === 'TROUBLESHOOTS'
        ? (Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 500
            ? limitParam
            : (statusFilter === 'CLOSE' ? 120 : 200))
        : (allowedPageSizes.has(limitParam) ? limitParam : 25)

    const page =
      roleUpper === 'TROUBLESHOOTS'
        ? 1
        : (Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1)

    const offset = roleUpper === 'TROUBLESHOOTS' ? 0 : (page - 1) * pageSize

    const orderSql =
      roleUpper === 'TROUBLESHOOTS' && statusFilter === 'CLOSE'
        ? `"closedAt" DESC NULLS LAST, "openedAt" DESC`
        : `"openedAt" DESC`

    if (roleUpper === 'TROUBLESHOOTS') {
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
          "temporaryAt",
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
        LIMIT ${pageSize};
      `

      const rows = await prisma.$queryRawUnsafe<unknown[]>(sql, ...params)
      return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
    }

    const fromSql = useSlaJoin
      ? `FROM "TroubleTicket" LEFT JOIN "TroubleTicketSla" s ON s."type" = "TroubleTicket"."type"`
      : `FROM "TroubleTicket"`

    const dupWhereSql = whereSql
      ? `${whereSql} AND COALESCE(TRIM("TroubleTicket"."user"), '') <> ''`
      : `WHERE COALESCE(TRIM("TroubleTicket"."user"), '') <> ''`

    const duplicatedUsersSql = `
      SELECT LOWER(TRIM("TroubleTicket"."user")) AS "userKey"
      ${fromSql}
      ${dupWhereSql}
      GROUP BY "userKey"
      HAVING COUNT(*) > 1;
    `
    const duplicatedUserRows = await prisma
      .$queryRawUnsafe<Array<{ userKey: string }>>(duplicatedUsersSql, ...params)
      .catch(() => [])
    const repeatedUsers = duplicatedUserRows.map((r) => String(r.userKey ?? '').trim()).filter(Boolean)

    const take = pageSize
    params.push(take)
    const limitToken = `$${params.length}`
    params.push(offset)
    const offsetToken = `$${params.length}`

    const sqlPaged = `
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
        "temporaryAt",
        "notes",
        "closeBy",
        "problemCategory",
        "resolutionAction",
        (
          COALESCE((SELECT COUNT(*) FROM "TroubleTicketPhoto" p WHERE p."ticketId" = "TroubleTicket"."id"), 0)
          + COALESCE(array_length("closePhotos", 1), 0)
        )::int AS "closePhotosCount",
        "status",
        COUNT(*) OVER()::int AS "totalCount"
      ${fromSql}
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${limitToken} OFFSET ${offsetToken};
    `

    const raw = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sqlPaged, ...params)
    const total = raw[0]?.totalCount ? Math.trunc(Number(raw[0]?.totalCount)) : 0
    const items = raw.map((r) => {
      const { totalCount, ...rest } = r
      void totalCount
      return rest
    })

    const summarySql = `
      SELECT
        COUNT(*) FILTER (WHERE "status" = 'OPEN')::int AS "open",
        COUNT(*) FILTER (WHERE "status" = 'CLOSE')::int AS "close",
        COUNT(*) FILTER (
          WHERE "status" = 'OPEN'
            AND NOW() - "openedAt" > (COALESCE(s."durationDays", 1) * INTERVAL '1 day')
        )::int AS "overdue"
      FROM "TroubleTicket"
      LEFT JOIN "TroubleTicketSla" s ON s."type" = "TroubleTicket"."type"
      ${summaryWhereSql};
    `
    const summaryRows = await prisma.$queryRawUnsafe<Array<{ open: number; close: number; overdue: number }>>(summarySql, ...baseParams).catch(() => [])
    const summary = summaryRows[0] ?? { open: 0, close: 0, overdue: 0 }

    return NextResponse.json(
      { items, total, page, limit: pageSize, summary, repeatedUsers },
      { headers: { 'Cache-Control': 'no-store' } }
    )
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
    const isUniqueViolation = (e: unknown) => {
      const code = (e as { code?: unknown })?.code
      const msg = e instanceof Error ? e.message : String(e)
      return String(code ?? '').includes('23505') || msg.includes('23505') || msg.toLowerCase().includes('duplicate key')
    }

    const insertOnce = async (allocated: { ticketCode: string; ticketPrefix: string; ticketNumber: number; category: string }) => {
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
      return rows[0] ?? null
    }

    let row: Record<string, unknown> | null = null
    if (parsed) {
      try {
        row = await insertOnce(parsed)
      } catch (e: unknown) {
        if (isUniqueViolation(e)) {
          return NextResponse.json({ error: 'ID Ticket sudah digunakan. Silakan refresh lalu coba lagi.' }, { status: 409 })
        }
        throw e
      }
    } else {
      for (let i = 0; i < 5; i += 1) {
        const allocated = await allocateTicketCode(periodMonth, periodYear, category)
        try {
          row = await insertOnce(allocated)
          if (row) break
        } catch (e: unknown) {
          if (isUniqueViolation(e)) {
            continue
          }
          throw e
        }
      }
    }
    if (!row) return NextResponse.json({ error: 'Failed to create trouble ticket' }, { status: 500 })
    cache.invalidateByPrefix('trouble-tickets-list:')
    cache.invalidateByPrefix('trouble-tickets:')
    const createdId = Math.trunc(Number(row.id))
    const createdCode = String(row.ticketCode ?? '').trim()
    const createdCustomer = String(row.customerName ?? '').trim()
    const title = 'Trouble Ticket Baru'
    const body = [createdCode, createdCustomer].filter(Boolean).join(' - ') || 'Ada trouble ticket baru'
    const rolesToNotify = ['ADMIN', 'CS', 'NOC', 'TEKNISI', 'TROUBLESHOOTS']
    const tokens = await listPushTokensForRoles(rolesToNotify)
    try {
      await sendFcmV1(tokens, {
        title,
        body,
        data: { ticketId: createdId, ticketCode: createdCode, category: String(row.category ?? '').trim() },
      })
    } catch {}
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to create trouble ticket' }, { status: 500 })
  }
}
