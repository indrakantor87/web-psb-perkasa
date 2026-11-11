import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'
import { ensureOdpTable } from '@/lib/odp-init'
import { ensureMenuAccess, ensureMenuMutation } from '@/lib/access-server'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuAccess(session, 'odp')
  if (accessError) return accessError

  try {
    await ensureOdpTable()

    let rows: Array<{ id: number; nama_pop: string; lokasi: string }> = []

    // Coba query dengan filter is_active (yang sudah ditambahkan ensureOdpTable).
    try {
      rows = await prisma.$queryRaw<Array<{ id: number; nama_pop: string; lokasi: string }>>`
        SELECT id, nama_pop, lokasi
        FROM psb_pop
        WHERE is_active IS NOT FALSE
        ORDER BY nama_pop ASC
      `
    } catch {
      // Fallback: jika kolom is_active belum ada, ambil semua tanpa filter.
      rows = await prisma.$queryRaw<Array<{ id: number; nama_pop: string; lokasi: string }>>`
        SELECT id, nama_pop, lokasi
        FROM psb_pop
        ORDER BY nama_pop ASC
      `
    }

    // Fallback: jika psb_pop kosong tapi ada ODC yang merujuk pop_id,
    // tampilkan placeholder agar dropdown tidak kosong.
    if (rows.length === 0) {
      const fromOdc = await prisma.$queryRaw<Array<{ id: number; nama_pop: string; lokasi: string }>>`
        SELECT DISTINCT
          d.pop_id AS id,
          ('POP ' || d.pop_id) AS nama_pop,
          '' AS lokasi
        FROM psb_odc d
        WHERE d.pop_id IS NOT NULL
        ORDER BY d.pop_id ASC
      `
      if (fromOdc.length > 0) rows = fromOdc
    }

    return NextResponse.json(rows)
  } catch (e) {
    console.error('[api/odp/pop] GET error:', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'odp')
  if (accessError) return accessError

  await ensureOdpTable()

  const body = await req.json().catch(() => ({}))
  const nama_pop = String(body?.nama_pop ?? '').trim()
  const lokasi = String(body?.lokasi ?? '').trim()

  if (!nama_pop) return NextResponse.json({ error: 'Nama POP wajib diisi' }, { status: 400 })

  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO psb_pop (nama_pop, lokasi, is_active, created_at, updated_at)
      VALUES (${nama_pop}, ${lokasi}, TRUE, NOW(), NOW())
      ON CONFLICT (lower(nama_pop)) WHERE is_active = TRUE
      DO UPDATE SET
        lokasi = EXCLUDED.lokasi,
        updated_at = NOW()
    `)
    cache.invalidateByPrefix('odp:')
    return NextResponse.json({ message: 'POP created' }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan POP' }, { status: 500 })
  }
}
