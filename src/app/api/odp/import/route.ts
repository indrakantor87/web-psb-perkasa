import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function toInt(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : NaN
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
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
      const terpakaiRaw = r.terpakai
      const terpakai = terpakaiRaw === null || typeof terpakaiRaw === 'undefined' || terpakaiRaw === '' ? 0 : toInt(terpakaiRaw)

      if (!nama_odp || !wilayah || !lokasi) { fail++; continue }
      if (!Number.isFinite(terpakai) || terpakai < 0 || terpakai > 8) { fail++; continue }

      normalizedRows.push({ nama_odp, wilayah, lokasi, terpakai, status_tiang })
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
            Prisma.sql`(${r.nama_odp}, ${r.wilayah}, ${r.lokasi}, ${r.terpakai}, ${r.status_tiang})`
          )
        )

        await prisma.$executeRaw(Prisma.sql`
          UPDATE psb_odp AS o
          SET wilayah = v.wilayah,
              lokasi = v.lokasi,
              kapasitas = 8,
              terpakai = v.terpakai,
              status_tiang = v.status_tiang,
              updated_at = NOW()
          FROM (VALUES ${values}) AS v(nama_odp, wilayah, lokasi, terpakai, status_tiang)
          WHERE o.is_active = TRUE
            AND lower(o.nama_odp) = lower(v.nama_odp)
            AND lower(o.wilayah) = lower(v.wilayah)
        `)

        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO psb_odp (nama_odp, wilayah, lokasi, kapasitas, terpakai, status_tiang, is_active, created_at, updated_at)
          SELECT v.nama_odp, v.wilayah, v.lokasi, 8, v.terpakai, v.status_tiang, TRUE, NOW(), NOW()
          FROM (VALUES ${values}) AS v(nama_odp, wilayah, lokasi, terpakai, status_tiang)
          WHERE NOT EXISTS (
            SELECT 1
            FROM psb_odp o
            WHERE o.is_active = TRUE
              AND lower(o.nama_odp) = lower(v.nama_odp)
              AND lower(o.wilayah) = lower(v.wilayah)
          )
        `)

        ok += chunk.length
      } catch {
        for (const r of chunk) {
          try {
            const existing = await prisma.$queryRaw<Array<{ id: number }>>`
              SELECT id
              FROM psb_odp
              WHERE is_active = TRUE AND lower(nama_odp) = lower(${r.nama_odp}) AND lower(wilayah) = lower(${r.wilayah})
              ORDER BY id DESC
              LIMIT 1
            `
            const existingId = existing[0]?.id

            if (existingId) {
              await prisma.$executeRaw`
                UPDATE psb_odp
                SET wilayah = ${r.wilayah},
                    lokasi = ${r.lokasi},
                    kapasitas = 8,
                    terpakai = ${r.terpakai},
                    status_tiang = ${r.status_tiang},
                    updated_at = NOW()
                WHERE id = ${existingId}
              `
            } else {
              await prisma.$executeRaw`
                INSERT INTO psb_odp (nama_odp, wilayah, lokasi, kapasitas, terpakai, status_tiang, is_active, created_at, updated_at)
                VALUES (${r.nama_odp}, ${r.wilayah}, ${r.lokasi}, 8, ${r.terpakai}, ${r.status_tiang}, TRUE, NOW(), NOW())
              `
            }
            ok++
          } catch {
            fail++
          }
        }
      }
    }

    return NextResponse.json({ message: `Import selesai. Berhasil: ${ok}, Gagal: ${fail}` })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
