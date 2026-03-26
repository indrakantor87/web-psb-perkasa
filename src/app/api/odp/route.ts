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

function parseLatLng(input: string) {
  const s = String(input ?? '').trim()
  if (!s) return null

  const direct = s.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  const at = s.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const q = s.match(/[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const ll = s.match(/[?&]ll=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const m = direct ?? at ?? q ?? ll
  if (!m) return null

  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null

  const aIsLat = a >= -90 && a <= 90
  const bIsLat = b >= -90 && b <= 90
  const aIsLng = a >= -180 && a <= 180
  const bIsLng = b >= -180 && b <= 180

  let latitude: number
  let longitude: number
  if (aIsLat && bIsLng) {
    latitude = a
    longitude = b
  } else if (aIsLng && bIsLat) {
    latitude = b
    longitude = a
  } else {
    return null
  }
  return { latitude, longitude }
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
  const map = (url.searchParams.get('map') ?? '').trim() === '1'
  const wilayah = (url.searchParams.get('wilayah') ?? '').trim()
  const page = Math.max(1, toInt(url.searchParams.get('page'), 1))
  const pageSize = Math.min(100, Math.max(5, toInt(url.searchParams.get('pageSize'), 10)))
  const offset = (page - 1) * pageSize
  const like = q ? `%${q}%` : ''
  const bypassCache = (url.searchParams.get('bypassCache') ?? '').trim() === '1'
  const cacheKey = `odp:${JSON.stringify({ q, all, map, wilayah, page, pageSize })}`

  try {
    if (!bypassCache) {
      const cached = cache.get<
        | {
            total: number
            page: number
            pageSize: number
            rows: Array<{ id: number; nama_odp: string; wilayah: string; lokasi: string; kapasitas: number; terpakai: number; status_tiang: string; latitude: number | null; longitude: number | null }>
            wilayahList: string[]
          }
        | Array<{ id: number; nama_odp: string; wilayah: string; lokasi: string; kapasitas: number; terpakai: number; status_tiang: string; latitude: number | null; longitude: number | null }>
      >(cacheKey)
      if (cached) {
        return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=60', 'X-Cache': 'HIT' } })
      }
    }
    const whereParts = [Prisma.sql`o.is_active = TRUE`]
    if (wilayah) whereParts.push(Prisma.sql`o.wilayah = ${wilayah}`)
    if (like) whereParts.push(Prisma.sql`(o.nama_odp ILIKE ${like} OR o.lokasi ILIKE ${like})`)
    if (map) whereParts.push(Prisma.sql`(o.latitude IS NOT NULL AND o.longitude IS NOT NULL) OR (o.lokasi ~ ${'[-0-9]{1,3}\\.[0-9]+'} AND o.lokasi LIKE ${'%,%'})`)
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
        latitude: number | null
        longitude: number | null
      }>
    >(Prisma.sql`
      SELECT o.id, o.nama_odp, o.wilayah, o.lokasi, o.kapasitas, o.terpakai, o.status_tiang, o.latitude, o.longitude
      FROM psb_odp o
      WHERE ${whereSql}
      ORDER BY o.id DESC
      LIMIT ${map ? 8000 : all ? 50000 : pageSize} OFFSET ${all || map ? 0 : offset}
    `)

    if (all || map) {
      const mapped = rows
        .map((r) => {
          if (r.latitude !== null && r.longitude !== null) return r
          const parsed = parseLatLng(r.lokasi)
          if (!parsed) return { ...r, latitude: null, longitude: null }
          return { ...r, latitude: parsed.latitude, longitude: parsed.longitude }
        })
        .filter((r) => r.latitude !== null && r.longitude !== null)
        .slice(0, map ? 5000 : 50000)

      if (!bypassCache) cache.set(cacheKey, mapped, 60_000)
      return NextResponse.json(mapped, { headers: { 'Cache-Control': bypassCache ? 'no-store' : 'private, max-age=60, stale-while-revalidate=120', 'X-Cache': bypassCache ? 'BYPASS' : 'MISS' } })
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
  const latitudeRaw = body?.latitude
  const longitudeRaw = body?.longitude
  const latitude = latitudeRaw === null || typeof latitudeRaw === 'undefined' || latitudeRaw === '' ? NaN : Number(latitudeRaw)
  const longitude = longitudeRaw === null || typeof longitudeRaw === 'undefined' || longitudeRaw === '' ? NaN : Number(longitudeRaw)
  const parsed = parseLatLng(lokasi)
  const finalLatitude = Number.isFinite(latitude) ? latitude : parsed?.latitude ?? null
  const finalLongitude = Number.isFinite(longitude) ? longitude : parsed?.longitude ?? null
  if (finalLatitude !== null && (finalLatitude < -90 || finalLatitude > 90)) return NextResponse.json({ error: 'Latitude tidak valid' }, { status: 400 })
  if (finalLongitude !== null && (finalLongitude < -180 || finalLongitude > 180)) return NextResponse.json({ error: 'Longitude tidak valid' }, { status: 400 })

  if (!nama_odp) return NextResponse.json({ error: 'Nama ODP wajib diisi' }, { status: 400 })
  if (!wilayah) return NextResponse.json({ error: 'Wilayah wajib diisi' }, { status: 400 })
  if (!lokasi) return NextResponse.json({ error: 'Lokasi wajib diisi' }, { status: 400 })
  if (!Number.isFinite(terpakai) || terpakai < 0) return NextResponse.json({ error: 'Terpakai tidak valid' }, { status: 400 })
  if (terpakai > kapasitas) return NextResponse.json({ error: 'Terpakai melebihi kapasitas' }, { status: 400 })

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO psb_odp (nama_odp, wilayah, lokasi, kapasitas, terpakai, status_tiang, latitude, longitude, is_active, created_at, updated_at)
    VALUES (${nama_odp}, ${wilayah}, ${lokasi}, ${kapasitas}, ${terpakai}, ${status_tiang}, ${finalLatitude}, ${finalLongitude}, TRUE, NOW(), NOW())
    ON CONFLICT ((lower(nama_odp)), (lower(wilayah))) WHERE is_active = TRUE
    DO UPDATE SET
      wilayah = EXCLUDED.wilayah,
      lokasi = EXCLUDED.lokasi,
      kapasitas = 8,
      terpakai = EXCLUDED.terpakai,
      status_tiang = EXCLUDED.status_tiang,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      updated_at = NOW()
  `)

  cache.invalidateByPrefix('odp:')
  return NextResponse.json({ ok: true }, { status: 201 })
}
