import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'

export const runtime = 'nodejs'

function toInt(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : NaN
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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureOdpTable()

  const { id } = await ctx.params
  const odpId = toInt(id)
  if (!Number.isFinite(odpId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const nama_odp = String(body?.nama_odp ?? '').trim()
  const wilayah = String(body?.wilayah ?? 'Pati').trim() || 'Pati'
  const lokasi = String(body?.lokasi ?? '').trim()
  const status_tiang = String(body?.status_tiang ?? 'Perkasa').trim() || 'Perkasa'
  const statusNorm = normalizeStatusTiang(status_tiang)
  const kapasitas = 8
  const terpakai = Math.trunc(Number(body?.terpakai ?? 0))

  if (!nama_odp) return NextResponse.json({ error: 'Nama ODP wajib diisi' }, { status: 400 })
  if (!wilayah) return NextResponse.json({ error: 'Wilayah wajib diisi' }, { status: 400 })
  if (!lokasi) return NextResponse.json({ error: 'Lokasi wajib diisi' }, { status: 400 })
  if (!Number.isFinite(terpakai) || terpakai < 0) return NextResponse.json({ error: 'Terpakai tidak valid' }, { status: 400 })
  if (terpakai > kapasitas) return NextResponse.json({ error: 'Terpakai melebihi kapasitas' }, { status: 400 })

  const conflict = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id
    FROM psb_odp
    WHERE is_active = TRUE
      AND id <> ${odpId}
      AND lower(nama_odp) = lower(${nama_odp})
      AND lower(wilayah) = lower(${wilayah})
    LIMIT 1
  `
  if (conflict[0]?.id) return NextResponse.json({ error: 'ODP sudah ada di POP tersebut' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE psb_odp
    SET nama_odp = ${nama_odp},
        wilayah = ${wilayah},
        lokasi = ${lokasi},
        kapasitas = ${kapasitas},
        terpakai = ${terpakai},
        status_tiang = ${statusNorm},
        updated_at = NOW()
    WHERE id = ${odpId} AND is_active = TRUE
  `

  cache.invalidateByPrefix('odp:')
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureOdpTable()

  const { id } = await ctx.params
  const odpId = toInt(id)
  if (!Number.isFinite(odpId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE psb_odp
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = ${odpId}
  `

  cache.invalidateByPrefix('odp:')
  return NextResponse.json({ ok: true })
}
