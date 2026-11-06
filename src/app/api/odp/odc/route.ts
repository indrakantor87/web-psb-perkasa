import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'
import { ensureOdpTable } from '@/lib/odp-init'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuAccess(session, 'odp')
  if (accessError) return accessError
  
  const url = new URL(req.url)
  const popId = url.searchParams.get('popId')

  try {
    await ensureOdpTable()
    let rows;
    if (popId) {
      rows = await prisma.$queryRaw<Array<{ id: number; nama_odc: string; pop_id: number; lokasi: string }>>`
        SELECT id, nama_odc, pop_id, lokasi
        FROM psb_odc
        WHERE is_active = TRUE AND pop_id = ${Number(popId)}
        ORDER BY nama_odc ASC
      `
    } else {
      rows = await prisma.$queryRaw<Array<{ id: number; nama_odc: string; pop_id: number; lokasi: string }>>`
        SELECT id, nama_odc, pop_id, lokasi
        FROM psb_odc
        WHERE is_active = TRUE
        ORDER BY nama_odc ASC
      `
    }
    return NextResponse.json(rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'odp')
  if (accessError) return accessError

  await ensureOdpTable()

  const body = await req.json().catch(() => ({}))
  const nama_odc = String(body?.nama_odc ?? '').trim()
  const pop_id = Number(body?.pop_id)
  const lokasi = String(body?.lokasi ?? '').trim()

  if (!nama_odc) return NextResponse.json({ error: 'Nama ODC wajib diisi' }, { status: 400 })
  if (!pop_id) return NextResponse.json({ error: 'POP wajib dipilih' }, { status: 400 })

  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO psb_odc (nama_odc, pop_id, lokasi, is_active, created_at, updated_at)
      VALUES (${nama_odc}, ${pop_id}, ${lokasi}, TRUE, NOW(), NOW())
      ON CONFLICT (lower(nama_odc)) WHERE is_active = TRUE
      DO UPDATE SET
        pop_id = EXCLUDED.pop_id,
        lokasi = EXCLUDED.lokasi,
        updated_at = NOW()
    `)
    cache.invalidateByPrefix('odp:')
    return NextResponse.json({ message: 'ODC created' }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Gagal menyimpan ODC' }, { status: 500 })
  }
}
