import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'
import { ensureOdpTable } from '@/lib/odp-init'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'
import { isAdminRole } from '@/lib/access'
import { parseLatLng } from '@/lib/geo'

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
  const accessError = ensureMenuAccess(session, 'odp')
  if (accessError) return accessError
  const activeSession = requireSession(session)

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
  const odcId = url.searchParams.get('odcId')
  const popId = url.searchParams.get('popId')
  const withoutOdc = (url.searchParams.get('withoutOdc') ?? '').trim() === '1'
  const divisionParam = (url.searchParams.get('division') ?? 'ALL').trim().toUpperCase()
  const page = Math.max(1, toInt(url.searchParams.get('page'), 1))
  const pageSize = Math.min(100, Math.max(5, toInt(url.searchParams.get('pageSize'), 10)))
  const offset = (page - 1) * pageSize
  const like = q ? `%${q}%` : ''
  const bypassCache = (url.searchParams.get('bypassCache') ?? '').trim() === '1'
  const roleUpper = (activeSession.user.role || '').toUpperCase()
  const divisionFilter =
    isAdminRole(roleUpper) &&
    ['ALL', 'PENJUALAN', 'CS_ADMIN', 'NOC_TROUBLESHOOTS', 'CREATOR_DIGITAL'].includes(divisionParam)
      ? divisionParam
      : 'ALL'
  const cacheKey = `odp:${JSON.stringify({ q, all, map, wilayah, odcId, popId, withoutOdc, divisionFilter, page, pageSize })}`

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
    if (wilayah && withoutOdc && popId) {
      whereParts.push(Prisma.sql`(o.pop_id = ${Number(popId)} OR lower(o.wilayah) = lower(${wilayah}))`)
    } else if (wilayah) {
      whereParts.push(Prisma.sql`o.wilayah = ${wilayah}`)
    }
    if (odcId) whereParts.push(Prisma.sql`o.odc_id = ${Number(odcId)}`)
    if (withoutOdc) whereParts.push(Prisma.sql`o.odc_id IS NULL`)
    if (like) whereParts.push(Prisma.sql`(o.nama_odp ILIKE ${like} OR o.lokasi ILIKE ${like})`)
    if (map) whereParts.push(Prisma.sql`((o.latitude IS NOT NULL AND o.longitude IS NOT NULL) OR (o.lokasi ~ ${'[-0-9]{1,3}\\.[0-9]+'} AND o.lokasi LIKE ${'%,%'}))`)
    if (isAdminRole(roleUpper) && divisionFilter !== 'ALL' && divisionFilter !== 'CS_ADMIN') {
      whereParts.push(Prisma.sql`1 = 0`)
    }
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
        pop_id: number | null
        odc_id: number | null
      }>
    >(Prisma.sql`
      SELECT o.id, o.nama_odp, o.wilayah, o.lokasi, o.kapasitas, o.terpakai, o.status_tiang, o.latitude, o.longitude, o.pop_id, o.odc_id
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
      const result = map
        ? mapped.filter((r) => r.latitude !== null && r.longitude !== null).slice(0, 5000)
        : mapped.slice(0, 50000)

      if (!bypassCache) cache.set(cacheKey, result, 60_000)
      return NextResponse.json(result, { headers: { 'Cache-Control': bypassCache ? 'no-store' : 'private, max-age=60, stale-while-revalidate=120', 'X-Cache': bypassCache ? 'BYPASS' : 'MISS' } })
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
  const accessError = ensureMenuMutation(session, 'odp')
  if (accessError) return accessError

  await ensureOdpTable()

  const body = await req.json().catch(() => ({}))
  const nama_odp = String(body?.nama_odp ?? '').trim()
  const wilayah = String(body?.wilayah ?? 'Pati').trim() || 'Pati'
  const lokasi = String(body?.lokasi ?? '').trim()
  const status_tiang = normalizeStatusTiang(String(body?.status_tiang ?? 'Perkasa').trim() || 'Perkasa')
  const kapasitasRaw = body?.kapasitas
  const kapasitas =
    kapasitasRaw === null || typeof kapasitasRaw === 'undefined' || kapasitasRaw === ''
      ? 8
      : Math.trunc(Number(kapasitasRaw))
  const terpakai = Math.trunc(Number(body?.terpakai ?? 0))
  const latitudeRaw = body?.latitude
  const longitudeRaw = body?.longitude
  const latitude = latitudeRaw === null || typeof latitudeRaw === 'undefined' || latitudeRaw === '' ? NaN : Number(latitudeRaw)
  const longitude = longitudeRaw === null || typeof longitudeRaw === 'undefined' || longitudeRaw === '' ? NaN : Number(longitudeRaw)
  const parsed = parseLatLng(lokasi)
  const finalLatitude = Number.isFinite(latitude) ? latitude : parsed?.latitude ?? null
  const finalLongitude = Number.isFinite(longitude) ? longitude : parsed?.longitude ?? null
  const pop_id = body?.pop_id ? Number(body.pop_id) : null
  const odc_id = body?.odc_id ? Number(body.odc_id) : null

  if (finalLatitude !== null && (finalLatitude < -90 || finalLatitude > 90)) return NextResponse.json({ error: 'Latitude tidak valid' }, { status: 400 })
  if (finalLongitude !== null && (finalLongitude < -180 || finalLongitude > 180)) return NextResponse.json({ error: 'Longitude tidak valid' }, { status: 400 })

  if (!nama_odp) return NextResponse.json({ error: 'Nama ODP wajib diisi' }, { status: 400 })
  if (!wilayah) return NextResponse.json({ error: 'Wilayah wajib diisi' }, { status: 400 })
  if (!lokasi) return NextResponse.json({ error: 'Lokasi wajib diisi' }, { status: 400 })
  if (!Number.isFinite(kapasitas) || kapasitas < 1) return NextResponse.json({ error: 'Kapasitas tidak valid' }, { status: 400 })
  if (kapasitas > 128) return NextResponse.json({ error: 'Kapasitas maksimal 128' }, { status: 400 })
  if (!Number.isFinite(terpakai) || terpakai < 0) return NextResponse.json({ error: 'Terpakai tidak valid' }, { status: 400 })
  if (terpakai > kapasitas) return NextResponse.json({ error: 'Terpakai melebihi kapasitas' }, { status: 400 })

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO psb_odp (nama_odp, wilayah, lokasi, kapasitas, terpakai, status_tiang, latitude, longitude, pop_id, odc_id, is_active, created_at, updated_at)
    VALUES (${nama_odp}, ${wilayah}, ${lokasi}, ${kapasitas}, ${terpakai}, ${status_tiang}, ${finalLatitude}, ${finalLongitude}, ${pop_id}, ${odc_id}, TRUE, NOW(), NOW())
    ON CONFLICT ((lower(nama_odp)), (lower(wilayah))) WHERE is_active = TRUE
    DO UPDATE SET
      wilayah = EXCLUDED.wilayah,
      lokasi = EXCLUDED.lokasi,
      kapasitas = EXCLUDED.kapasitas,
      terpakai = EXCLUDED.terpakai,
      status_tiang = EXCLUDED.status_tiang,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      pop_id = EXCLUDED.pop_id,
      odc_id = EXCLUDED.odc_id,
      updated_at = NOW()
  `)

  cache.invalidateByPrefix('odp:')
  return NextResponse.json({ message: 'ODP created' }, { status: 201 })
}
