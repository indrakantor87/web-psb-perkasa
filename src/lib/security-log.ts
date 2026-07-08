import { prisma } from '@/lib/prisma'

type GlobalState = {
  __securityLogInitPromise?: Promise<void>
  __securityLogPrunedMonth?: string
}

const g = globalThis as unknown as GlobalState

function monthKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function extractIp(headers: Headers) {
  const forwarded =
    headers.get('x-forwarded-for') ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    headers.get('true-client-ip') ||
    ''
  const raw = forwarded.split(',')[0]?.trim()
  return raw || null
}

export type SecurityLogAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'ISOLATIONS_IMPORT'

export async function ensureSecurityLogTable() {
  if (!g.__securityLogInitPromise) {
    g.__securityLogInitPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SecurityLogs" (
          "id" SERIAL PRIMARY KEY,
          "monthKey" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "userId" INTEGER,
          "username" TEXT,
          "role" TEXT,
          "action" TEXT NOT NULL,
          "path" TEXT,
          "method" TEXT,
          "ip" TEXT,
          "userAgent" TEXT,
          "meta" JSONB
        );
      `)

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "SecurityLogs_monthKey_createdAt_idx"
        ON "SecurityLogs" ("monthKey", "createdAt");
      `)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "SecurityLogs_userId_createdAt_idx"
        ON "SecurityLogs" ("userId", "createdAt");
      `)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "SecurityLogs_monthKey_username_action_ip_idx"
        ON "SecurityLogs" ("monthKey", "username", "action", "ip");
      `)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "SecurityLogs_monthKey_action_role_createdAt_idx"
        ON "SecurityLogs" ("monthKey", "action", "role", "createdAt");
      `)
    })()
  }

  await g.__securityLogInitPromise
}

export async function logSecurityEvent(input: {
  action: SecurityLogAction
  request?: Request
  user?: { id?: number; username?: string; role?: string } | null
  meta?: Record<string, unknown> | null
}) {
  await ensureSecurityLogTable()

  const mk = monthKey()
  if (g.__securityLogPrunedMonth !== mk) {
    g.__securityLogPrunedMonth = mk
    await prisma.$executeRawUnsafe(`DELETE FROM "SecurityLogs" WHERE "monthKey" <> $1;`, mk)
  }

  const headers = input.request?.headers
  const ip = headers ? extractIp(headers) : null
  const userAgent = headers?.get('user-agent') || null
  const path = input.request ? new URL(input.request.url).pathname : null
  const method = input.request?.method || null

  const userId = typeof input.user?.id === 'number' ? input.user.id : null
  const username = input.user?.username ? String(input.user.username) : null
  const role = input.user?.role ? String(input.user.role) : null

  let mergedMeta: Record<string, unknown> | null = input.meta ? { ...input.meta } : null
  if (
    String(input.action) === 'LOGIN_SUCCESS' &&
    String(role ?? '').toUpperCase() === 'MARKETING' &&
    username &&
    ip
  ) {
    try {
      const existing = await prisma.$queryRawUnsafe<Array<{ ok: number }>>(
        `SELECT 1 as ok
         FROM "SecurityLogs"
         WHERE "monthKey" = $1
           AND "username" = $2
           AND "action" = 'LOGIN_SUCCESS'
           AND "ip" = $3
         LIMIT 1;`,
        mk,
        username,
        ip
      )
      const isNewIp = !existing || existing.length === 0
      const base = mergedMeta ?? {}
      base.isNewIp = isNewIp
      base.ip = ip
      base.username = username
      mergedMeta = base
    } catch {}
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "SecurityLogs" ("monthKey","userId","username","role","action","path","method","ip","userAgent","meta")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb);`,
    mk,
    userId,
    username,
    role,
    String(input.action),
    path,
    method,
    ip,
    userAgent,
    mergedMeta ? JSON.stringify(mergedMeta) : null
  )
}
