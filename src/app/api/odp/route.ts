import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'
import { ensureOdpTable } from '@/lib/odp-init'

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
    const whereParts = [Prisma.sql`o.is_active = TRUE`]
    if (wilayah) whereParts.push(Prisma.sql`o.wilayah = ${wilayah}`)
    if (like) whereParts.push(Prisma.sql`(o.nama_odp ILIKE ${like} OR o.lokasi ILIKE ${like})`)
    const whereSql = Prisma.join(whereParts, ' AND ')

    const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS total
      FROM psb_odp o
      WHERE ${whereSql}
    `)
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
    >(Prisma.sql`
      SELECT o.id, o.nama_odp, o.wilayah, o.lokasi, o.kapasitas, o.terpakai, o.status_tiang
      FROM psb_odp o
      WHERE ${whereSql}
      ORDER BY o.id DESC
      LIMIT ${all ? 50000 : pageSize} OFFSET ${all ? 0 : offset}
    `)

    if (all) {
      if (!bypassCache) cache.set(cacheKey, rows, 60_000)
      return NextResponse.json(rows, { headers: { 'Cache-Control': bypassCache ? 'no-store' : 'private, max-age=60, stale-while-revalidate=120', 'X-Cache': bypassCache ? 'BYPASS' : 'MISS' } })
    }

    const wilayahCacheKey = 'odp:wilayahList'
    let wilayahList = cache.get<string[]>(wilayahCacheKey)
    if (!wilayahList) {
      const wilayahRows = await prisma.$queryRaw<Array<{ wilayah: string }>>`
        SELECT DISTINCT o.wilayah
        FROM psb_odp o
        WHERE o.is_active = TRUE
        ORDER BY o.wilayah ASC
      `
      wilayahList = wilayahRows.map((x) => x.wilayah).filter(Boolean)
      cache.set(wilayahCacheKey, wilayahList, 5 * 60_000)
    }

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
