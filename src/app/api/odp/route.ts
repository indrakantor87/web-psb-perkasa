import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function toInt(v: string | null, fallback: number) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function normalizeStatusTiang(s: string) {
  const t = s.toLowerCase().replace(/\s+/g, '')
  if (t === 'na' || t === 'n/a') return 'n/a'
  if (t === 'perkasa') return 'Perkasa'
  if (t === 'numpang') return 'Numpang'
  return s
}

async function ensureOdpTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS psb_odp (
      id SERIAL PRIMARY KEY,
      nama_odp VARCHAR(100) NOT NULL,
      wilayah VARCHAR(50) NOT NULL DEFAULT 'Pati',
      lokasi TEXT NOT NULL,
      kapasitas INT NOT NULL DEFAULT 8,
      terpakai INT NOT NULL DEFAULT 0,
      status_tiang VARCHAR(50) NOT NULL DEFAULT 'Tegak',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE psb_odp
    ADD COLUMN IF NOT EXISTS wilayah VARCHAR(50) NOT NULL DEFAULT 'Pati';
  `)

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_active ON psb_odp (is_active);`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_wilayah ON psb_odp (wilayah);`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_nama_odp ON psb_odp (nama_odp);`)
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_nama_odp_trgm ON psb_odp USING gin (nama_odp gin_trgm_ops);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_lokasi_trgm ON psb_odp USING gin (lokasi gin_trgm_ops);`)
  } catch {}

  const idx = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'psb_odp'
        AND indexname = 'uq_psb_odp_key_active'
    ) AS "exists"
  `
  if (!idx[0]?.exists) {
    await prisma.$executeRawUnsafe(`
      WITH ranked AS (
        SELECT id,
               row_number() OVER (PARTITION BY lower(nama_odp), lower(wilayah) ORDER BY id DESC) AS rn
        FROM psb_odp
        WHERE is_active = TRUE
      )
      UPDATE psb_odp
      SET is_active = FALSE, updated_at = NOW()
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_psb_odp_key_active ON psb_odp ((lower(nama_odp)), (lower(wilayah))) WHERE is_active = TRUE;`
    )
  }
}


export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  if (session && session.user.role === 'MARKETING') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await ensureOdpTable()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'DB error' }, { status: 500 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const all = (url.searchParams.get('all') ?? '').trim() === '1'
  const wilayah = (url.searchParams.get('wilayah') ?? '').trim()
  const page = Math.max(1, toInt(url.searchParams.get('page'), 1))
  const pageSize = Math.min(100, Math.max(5, toInt(url.searchParams.get('pageSize'), 10)))
  const offset = (page - 1) * pageSize
  const like = q ? `%${q}%` : ''
  const bypassCache = (url.searchParams.get('bypassCache') ?? '').trim() === '1'
  const cacheKey = `odp:${JSON.stringify({ q, all, wilayah, page, pageSize })}`

  try {
    if (!bypassCache) {
      const cached = cache.get<{ total: number; page: number; pageSize: number; rows: Array<{ id: number; nama_odp: string; wilayah: string; lokasi: string; kapasitas: number; terpakai: number; status_tiang: string }>; wilayahList: string[] } | Array<{ id: number; nama_odp: string; wilayah: string; lokasi: string; kapasitas: number; terpakai: number; status_tiang: string }>>(cacheKey)
      if (cached) {
        return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=60', 'X-Cache': 'HIT' } })
      }
    }
    const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total
      FROM psb_odp o
      WHERE o.is_active = TRUE
        AND (${wilayah} = '' OR o.wilayah = ${wilayah})
        AND (${like} = '' OR o.nama_odp ILIKE ${like} OR o.lokasi ILIKE ${like})
    `
    const totalValue = totalRows[0]?.total
    const total = typeof totalValue === 'bigint' ? Number(totalValue) : Number(totalValue ?? 0)

    const rows = await prisma.$queryRaw<
      Array<{
        id: number
        nama_odp: string
        wilayah: string
        lokasi: string
        kapasitas: number
        terpakai: number
        status_tiang: string
      }>
    >`
      SELECT o.id, o.nama_odp, o.wilayah, o.lokasi, o.kapasitas, o.terpakai, o.status_tiang
      FROM psb_odp o
      WHERE o.is_active = TRUE
        AND (${wilayah} = '' OR o.wilayah = ${wilayah})
        AND (${like} = '' OR o.nama_odp ILIKE ${like} OR o.lokasi ILIKE ${like})
      ORDER BY o.id DESC
      LIMIT ${all ? 50000 : pageSize} OFFSET ${all ? 0 : offset}
    `

    if (all) {
      if (!bypassCache) cache.set(cacheKey, rows, 60_000)
      return NextResponse.json(rows, { headers: { 'Cache-Control': bypassCache ? 'no-store' : 'private, max-age=60, stale-while-revalidate=120', 'X-Cache': bypassCache ? 'BYPASS' : 'MISS' } })
    }

    const wilayahRows = await prisma.$queryRaw<Array<{ wilayah: string }>>`
      SELECT DISTINCT o.wilayah
      FROM psb_odp o
      WHERE o.is_active = TRUE
      ORDER BY o.wilayah ASC
    `
    const wilayahList = wilayahRows.map((x) => x.wilayah).filter(Boolean)

    const payload = { total, page, pageSize, rows, wilayahList }
    if (!bypassCache) cache.set(cacheKey, payload, 20_000)
    return NextResponse.json(payload, { headers: { 'Cache-Control': bypassCache ? 'no-store' : 'private, max-age=20, stale-while-revalidate=60', 'X-Cache': bypassCache ? 'BYPASS' : 'MISS' } })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'DB error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureOdpTable()

  const body = await req.json().catch(() => ({}))
  const nama_odp = String(body?.nama_odp ?? '').trim()
  const wilayah = String(body?.wilayah ?? 'Pati').trim() || 'Pati'
  const lokasi = String(body?.lokasi ?? '').trim()
  const status_tiang = normalizeStatusTiang(String(body?.status_tiang ?? 'Perkasa').trim() || 'Perkasa')
  const kapasitas = 8
  const terpakai = Math.trunc(Number(body?.terpakai ?? 0))

  if (!nama_odp) return NextResponse.json({ error: 'Nama ODP wajib diisi' }, { status: 400 })
  if (!wilayah) return NextResponse.json({ error: 'Wilayah wajib diisi' }, { status: 400 })
  if (!lokasi) return NextResponse.json({ error: 'Lokasi wajib diisi' }, { status: 400 })
  if (!Number.isFinite(terpakai) || terpakai < 0) return NextResponse.json({ error: 'Terpakai tidak valid' }, { status: 400 })
  if (terpakai > kapasitas) return NextResponse.json({ error: 'Terpakai melebihi kapasitas' }, { status: 400 })

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO psb_odp (nama_odp, wilayah, lokasi, kapasitas, terpakai, status_tiang, is_active, created_at, updated_at)
    VALUES (${nama_odp}, ${wilayah}, ${lokasi}, ${kapasitas}, ${terpakai}, ${status_tiang}, TRUE, NOW(), NOW())
    ON CONFLICT ((lower(nama_odp)), (lower(wilayah))) WHERE is_active = TRUE
    DO UPDATE SET
      wilayah = EXCLUDED.wilayah,
      lokasi = EXCLUDED.lokasi,
      kapasitas = 8,
      terpakai = EXCLUDED.terpakai,
      status_tiang = EXCLUDED.status_tiang,
      updated_at = NOW()
  `)

  cache.invalidateByPrefix('odp:')
  return NextResponse.json({ ok: true }, { status: 201 })
}
