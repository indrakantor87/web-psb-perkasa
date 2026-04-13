import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

type Kind = 'PROBLEM_CATEGORY' | 'RESOLUTION_ACTION'

const DEFAULT_PROBLEM_CATEGORIES = [
  'LOSS/LOS',
  'NO INTERNET',
  'PUTUS-NYAMBUNG',
  'LEMOT',
  'HIGH LATENCY',
  'PACKET LOSS',
  'MODEM/ONT',
  'ROUTER/WIFI',
  'ADAPTOR/POWER',
  'KABEL/DROPCORE',
  'ODP/PORT',
  'KONFIGURASI/PPPOE',
  'LAINNYA',
]

const DEFAULT_RESOLUTION_ACTIONS = [
  'GANTI ADAPTOR',
  'GANTI MODEM/ONT',
  'GANTI ROUTER',
  'GESER PERANGKAT',
  'RESET/REKONFIGURASI',
  'RE-TERMINASI KABEL',
  'GANTI PATCHCORD',
  'CLEANING KONEKTOR',
  'PINDAH PORT ODP',
  'PERBAIKI DROPCORE',
  'SPLICING ULANG',
  'LAINNYA',
]

let ensuredPromise: Promise<void> | null = null

function normalizeKind(input: unknown): Kind | null {
  const k = String(input ?? '').trim().toUpperCase()
  if (k === 'PROBLEM_CATEGORY' || k === 'RESOLUTION_ACTION') return k
  return null
}

function normalizeValue(input: unknown) {
  const v = String(input ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
  return v
}

async function ensureMasterTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicketMaster" (
      "id" SERIAL NOT NULL,
      "kind" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TroubleTicketMaster_pkey" PRIMARY KEY ("id")
    );
  `)
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicketMaster_kind_value_key" ON "TroubleTicketMaster"("kind","value");`
  )
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicketMaster_kind_idx" ON "TroubleTicketMaster"("kind");`)

  await prisma.$executeRawUnsafe(
    `INSERT INTO "TroubleTicketMaster" ("kind","value")
     SELECT 'PROBLEM_CATEGORY', x
     FROM unnest($1::text[]) AS x
     ON CONFLICT DO NOTHING;`,
    DEFAULT_PROBLEM_CATEGORIES
  )
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TroubleTicketMaster" ("kind","value")
     SELECT 'RESOLUTION_ACTION', x
     FROM unnest($1::text[]) AS x
     ON CONFLICT DO NOTHING;`,
    DEFAULT_RESOLUTION_ACTIONS
  )
}

async function ensureMasterTableOnce() {
  if (!ensuredPromise) {
    ensuredPromise = ensureMasterTable().catch((e) => {
      ensuredPromise = null
      throw e
    })
  }
  await ensuredPromise
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI', 'TROUBLESHOOTS']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureMasterTableOnce().catch(() => {})

  const { searchParams } = new URL(request.url)
  const kind = normalizeKind(searchParams.get('kind'))
  if (!kind) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; value: string }>>(
      `SELECT "id","value"
       FROM "TroubleTicketMaster"
       WHERE "kind" = $1
       ORDER BY "value" ASC;`,
      kind
    )
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to fetch master data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureMasterTableOnce().catch(() => {})

  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; value?: unknown }
  const kind = normalizeKind(body.kind)
  const value = normalizeValue(body.value)
  if (!kind) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  if (!value) return NextResponse.json({ error: 'Value wajib diisi' }, { status: 400 })

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; kind: string; value: string }>>(
      `INSERT INTO "TroubleTicketMaster" ("kind","value")
       VALUES ($1,$2)
       ON CONFLICT ("kind","value") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "id","kind","value";`,
      kind,
      value
    )
    return NextResponse.json(rows[0] ?? { ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to create master data' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureMasterTableOnce().catch(() => {})

  const { searchParams } = new URL(request.url)
  const id = Math.trunc(Number(searchParams.get('id')))
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "TroubleTicketMaster" WHERE "id" = $1;`, id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to delete master data' }, { status: 500 })
  }
}
