import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

let ensured: Promise<void> | null = null

async function ensurePushTokenTableOnce() {
  if (!ensured) {
    ensured = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "DevicePushToken" (
          "id" SERIAL NOT NULL,
          "token" TEXT NOT NULL,
          "platform" TEXT NOT NULL DEFAULT 'unknown',
          "userRole" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT "DevicePushToken_pkey" PRIMARY KEY ("id")
        );
      `)
      .then(async () => {
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DevicePushToken_token_key" ON "DevicePushToken"("token");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DevicePushToken_role_idx" ON "DevicePushToken"("userRole");`)
      })
      .catch((e) => {
        ensured = null
        throw e
      })
  }
  await ensured
}

export async function GET() {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const enabled = Boolean(
    String(process.env.FCM_PROJECT_ID ?? '').trim() &&
      String(process.env.FCM_CLIENT_EMAIL ?? '').trim() &&
      String(process.env.FCM_PRIVATE_KEY ?? '').trim()
  )
  return NextResponse.json({ enabled })
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensurePushTokenTableOnce().catch(() => {})

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const token = String(body.token ?? '').trim()
  const platform = String(body.platform ?? 'unknown').trim() || 'unknown'
  const userRole = String(body.userRole ?? session.user.role ?? '').trim() || null

  if (!token || token.length < 20) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  await prisma.$executeRawUnsafe(
    `INSERT INTO "DevicePushToken" ("token","platform","userRole","createdAt","updatedAt","lastSeenAt")
     VALUES ($1,$2,$3,NOW(),NOW(),NOW())
     ON CONFLICT ("token")
     DO UPDATE SET "platform" = EXCLUDED."platform", "userRole" = EXCLUDED."userRole", "updatedAt" = NOW(), "lastSeenAt" = NOW();`,
    token,
    platform,
    userRole
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensurePushTokenTableOnce().catch(() => {})

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const token = String(body.token ?? '').trim()
  if (!token) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  await prisma.$executeRawUnsafe(`DELETE FROM "DevicePushToken" WHERE "token" = $1;`, token)
  return NextResponse.json({ ok: true })
}
