import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { cache } from '@/lib/cache'
import { ensureOdpTable } from '@/lib/odp-init'
import { ensureMenuMutation } from '@/lib/access-server'

export const runtime = 'nodejs'

function toInt(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : NaN
}

function parseLatLng(input: string) {
  const s = String(input ?? '').trim()
  if (!s) return null

  const direct = s.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  const at = s.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const q = s.match(/[?&]q=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const ll = s.match(/[?&]ll=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const m = direct ?? at ?? q ?? ll
  if (!m) return null

  const latitude = Number(m[1])
  const longitude = Number(m[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90) return null
  if (longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

export async function POST(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'odp')
  if (accessError) return accessError

  await ensureOdpTable()

  try {
    const XLSX = await import('xlsx')

    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    let rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

    const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : '')
    const mapField = (key: unknown) => {
      const k = norm(key)
      if (['NAMA ODP', 'ODP', 'NAMA'].includes(k)) return 'nama_odp'
      if (['POP', 'WILAYAH', 'REGION', 'AREA'].includes(k)) return 'wilayah'
      if (['LOKASI', 'ALAMAT'].includes(k)) return 'lokasi'
      if (['KAPASITAS', 'KAPASITAS ODP', 'CAPACITY'].includes(k)) return 'kapasitas'
      if (['KOORDINAT', 'KOORDINAT (LAT,LNG)', 'COORDINATE', 'COORDINATES', 'COORDS', 'MAPS'].includes(k)) return 'koordinat'
      if (['LAT', 'LATITUDE'].includes(k)) return 'latitude'
      if (['LNG', 'LON', 'LONG', 'LONGITUDE'].includes(k)) return 'longitude'
      if (['TERPAKAI', 'USED'].includes(k)) return 'terpakai'
      if (['STATUS TIANG', 'TIANG'].includes(k)) return 'status_tiang'
      return ''
    }

    const toOdpRow = (row: Record<string, unknown>) => {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(row)) {
        const f = mapField(k)
        if (f) out[f] = v
      }
      return out
    }

    if (!rawRows || rawRows.length === 0 || rawRows.every((r) => Object.keys(toOdpRow(r)).length === 0)) {
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
      let headerIdx = -1
      for (let i = 0; i < aoa.length; i++) {
        const row = aoa[i] || []
        const fields = row.map((c) => mapField(c)).filter(Boolean)
        const hasRequired = fields.includes('nama_odp') && fields.includes('wilayah') && fields.includes('lokasi')
        if (hasRequired) {
          headerIdx = i
          break
        }
      }
      if (headerIdx >= 0) {
        const headerRow = aoa[headerIdx] || []
        const indexMap: Record<number, string> = {}
        headerRow.forEach((h, idx) => {
          const f = mapField(h)
          if (f) indexMap[idx] = f
        })
        const collected: Array<Record<string, unknown>> = []
        for (let r = headerIdx + 1; r < aoa.length; r++) {
          const row = aoa[r] || []
          const obj: Record<string, unknown> = {}
          Object.entries(indexMap).forEach(([idxStr, field]) => {
            const idx = Number(idxStr)
            obj[field] = row[idx] ?? null
          })
          collected.push(obj)
        }
        rawRows = collected
      }
    }

    const normalizedRows: Array<{
      nama_odp: string
      wilayah: string
      lokasi: string
      kapasitas: number
      latitude: number | null
      longitude: number | null
      terpakai: number
      status_tiang: string
    }> = []

    let ok = 0
    let fail = 0

    for (const row of rawRows) {
      const r = Object.prototype.hasOwnProperty.call(row, 'nama_odp') ? row : toOdpRow(row)
      const isTrulyEmpty = Object.values(r).every((v) => v === null || v === '' || typeof v === 'undefined')
      if (isTrulyEmpty) continue

      const nama_odp = String(r.nama_odp ?? '').trim()
      const wilayah = String(r.wilayah ?? 'Pati').trim() || 'Pati'
      const lokasi = String(r.lokasi ?? '').trim()
      const latRaw = r.latitude
      const lngRaw = r.longitude
      const lat = latRaw === null || typeof latRaw === 'undefined' || latRaw === '' ? NaN : Number(latRaw)
      const lng = lngRaw === null || typeof lngRaw === 'undefined' || lngRaw === '' ? NaN : Number(lngRaw)
      const koordinat = String((r as Record<string, unknown>).koordinat ?? '').trim()
      const parsedFromKoordinat = parseLatLng(koordinat)
      const parsedFromLokasi = parseLatLng(lokasi)
      const latitude = Number.isFinite(lat) ? lat : parsedFromKoordinat?.latitude ?? parsedFromLokasi?.latitude ?? null
      const longitude = Number.isFinite(lng) ? lng : parsedFromKoordinat?.longitude ?? parsedFromLokasi?.longitude ?? null
      const statusRaw = String(r.status_tiang ?? '').trim()
      const t = statusRaw.toLowerCase().replace(/\s+/g, '')
      const status_tiang =
        t === '' || t === 'na' || t === 'n/a'
          ? 'n/a'
          : t === 'perkasa'
            ? 'Perkasa'
            : t === 'numpang'
              ? 'Numpang'
              : statusRaw
      const kapasitasRaw = (r as Record<string, unknown>).kapasitas
      const kapasitas =
        kapasitasRaw === null || typeof kapasitasRaw === 'undefined' || kapasitasRaw === '' ? 8 : toInt(kapasitasRaw)
      const terpakaiRaw = r.terpakai
      const terpakai = terpakaiRaw === null || typeof terpakaiRaw === 'undefined' || terpakaiRaw === '' ? 0 : toInt(terpakaiRaw)

      if (!nama_odp || !wilayah || !lokasi) { fail++; continue }
      if (!Number.isFinite(kapasitas) || kapasitas < 1 || kapasitas > 128) { fail++; continue }
      if (!Number.isFinite(terpakai) || terpakai < 0 || terpakai > kapasitas) { fail++; continue }
      if (latitude !== null && (latitude < -90 || latitude > 90)) { fail++; continue }
      if (longitude !== null && (longitude < -180 || longitude > 180)) { fail++; continue }

      normalizedRows.push({ nama_odp, wilayah, lokasi, kapasitas, latitude, longitude, terpakai, status_tiang })
    }

    const map = new Map<string, (typeof normalizedRows)[number]>()
    for (const r of normalizedRows) {
      map.set(`${r.nama_odp.toLowerCase()}|${r.wilayah.toLowerCase()}`, r)
    }
    const rowsToProcess = Array.from(map.values())

    const batchSize = 500
    for (let i = 0; i < rowsToProcess.length; i += batchSize) {
      const chunk = rowsToProcess.slice(i, i + batchSize)
      if (chunk.length === 0) continue
      try {
        const values = Prisma.join(
          chunk.map((r) =>
            Prisma.sql`(${r.nama_odp}, ${r.wilayah}, ${r.lokasi}, ${r.kapasitas}, ${r.terpakai}, ${r.status_tiang}, ${r.latitude}, ${r.longitude}, TRUE, NOW(), NOW())`
          )
        )

        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO psb_odp (nama_odp, wilayah, lokasi, kapasitas, terpakai, status_tiang, latitude, longitude, is_active, created_at, updated_at)
          VALUES ${values}
          ON CONFLICT ((lower(nama_odp)), (lower(wilayah))) WHERE is_active = TRUE
          DO UPDATE SET
            wilayah = EXCLUDED.wilayah,
            lokasi = EXCLUDED.lokasi,
            kapasitas = EXCLUDED.kapasitas,
            terpakai = EXCLUDED.terpakai,
            status_tiang = EXCLUDED.status_tiang,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            updated_at = NOW()
        `)

        ok += chunk.length
      } catch {
        for (const r of chunk) {
          try {
            await prisma.$executeRaw(Prisma.sql`
              INSERT INTO psb_odp (nama_odp, wilayah, lokasi, kapasitas, terpakai, status_tiang, latitude, longitude, is_active, created_at, updated_at)
              VALUES (${r.nama_odp}, ${r.wilayah}, ${r.lokasi}, ${r.kapasitas}, ${r.terpakai}, ${r.status_tiang}, ${r.latitude}, ${r.longitude}, TRUE, NOW(), NOW())
              ON CONFLICT ((lower(nama_odp)), (lower(wilayah))) WHERE is_active = TRUE
              DO UPDATE SET
                wilayah = EXCLUDED.wilayah,
                lokasi = EXCLUDED.lokasi,
                kapasitas = EXCLUDED.kapasitas,
                terpakai = EXCLUDED.terpakai,
                status_tiang = EXCLUDED.status_tiang,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                updated_at = NOW()
            `)
            ok++
          } catch {
            fail++
          }
        }
      }
    }

    cache.invalidateByPrefix('odp:')
    return NextResponse.json({ message: `Import selesai. Berhasil: ${ok}, Gagal: ${fail}` })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
