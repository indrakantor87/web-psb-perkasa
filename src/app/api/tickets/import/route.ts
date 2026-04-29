import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { jakartaDateFromDMY, jakartaDateFromExcelSerial } from '@/lib/jakarta-time'
// Note: use dynamic import for 'xlsx' to avoid bundling issues on Vercel

export const runtime = 'nodejs'

function statusOrderFor(status: string) {
  const s = (status || '').toUpperCase()
  if (s === 'OPEN') return 0
  if (s === 'ON_PROGRESS' || s === 'PENDING') return 1
  if (s === 'CLOSE') return 3
  return 9
}

function normalizeStatus(input: unknown) {
  const s = String(input ?? '').trim()
  if (!s) return undefined
  const normalized = s.toUpperCase().replace(/\s+/g, '_')
  if (normalized === 'PENDING') return 'ON_PROGRESS'
  if (normalized === 'ONPROGRESS') return 'ON_PROGRESS'
  return normalized
}

function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof value === 'number') {
    return jakartaDateFromExcelSerial(value)
  }
  if (typeof value === 'string') {
    const parts = value.split(/[\/\-]/)
    if (parts.length === 3) {
      const [d, m, y] = parts.map(p => parseInt(p, 10))
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        const year = y < 100 ? 2000 + y : y
        return jakartaDateFromDMY(d, m, year)
      }
    }
    const dt = new Date(value)
    if (isNaN(dt.getTime())) return null
    return jakartaDateFromDMY(dt.getDate(), dt.getMonth() + 1, dt.getFullYear())
  }
  return null
}

function normalizePhoneNumber(value: unknown) {
  if (value === null || typeof value === 'undefined') return ''
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(0)
  return String(value).trim()
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const XLSX = await import('xlsx')
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false })

    // Header normalization helpers
    const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : '')
    const mapField = (key: string) => {
      const k = norm(key)
      if (['NAMA PELANGGAN','NAMA','CUSTOMER','NAMA CUSTOMER'].includes(k)) return 'customerName'
      if (['TANGGAL LAHIR','TGL LAHIR','BIRTH DATE','BIRTHDATE'].includes(k)) return 'birthDate'
      if (['MAPS LOKASI','LOKASI MAPS','LOKASI','MAPS','LOCATION MAP'].includes(k)) return 'locationMap'
      if (['TGL REQUEST','TANGGAL REQUEST','REQUEST DATE'].includes(k)) return 'requestDate'
      if (['TGL TERPASANG','TANGGAL PASANG','INSTALLED DATE','INSTALL DATE'].includes(k)) return 'installedDate'
      if (['PAKET','PACKAGE'].includes(k)) return 'package'
      if (['MARKETING','NAMA MARKETING','SALES'].includes(k)) return 'marketingName'
      if (['PENGAWALAN'].includes(k)) return 'pengawalan'
      if (['KMZ'].includes(k)) return 'kmz'
      if (['PRIORITAS','PRIORITY'].includes(k)) return 'priority'
      if (['KETERANGAN','CATATAN','DESCRIPTION'].includes(k)) return 'description'
      if (['PEMBAYARAN','PAYMENT'].includes(k)) return 'pembayaran'
      if (['STATUS'].includes(k)) return 'status'
      if (['NO HP','NO TELP','NO TELEPON','NO WA','WA','NO WA AKTIF','NOHP','PHONE','TELEPON'].includes(k)) return 'phoneNumber'
      if (['TEKNISI','INSTALLER'].includes(k)) return 'teknisi'
      if (['FOTO RUMAH','FOTO','PHOTO','PHOTO RUMAH'].includes(k)) return 'fotoRumah'
      return ''
    }
    type TicketRow = {
      customerName?: unknown
      birthDate?: unknown
      locationMap?: unknown
      requestDate?: unknown
      installedDate?: unknown
      package?: unknown
      marketingName?: unknown
      teknisi?: unknown
      pengawalan?: unknown
      kmz?: unknown
      priority?: unknown
      description?: unknown
      pembayaran?: unknown
      status?: unknown
      phoneNumber?: unknown
      fotoRumah?: unknown
    }

    const toTicketRow = (row: Record<string, unknown>): TicketRow => {
      const out: TicketRow = {}
      for (const [k, v] of Object.entries(row)) {
        const f = mapField(k)
        if (f) (out as Record<string, unknown>)[f] = v
      }
      return out
    }

    // Fallback: jika rows kosong (header bukan di baris pertama), cari header secara dinamis
    if (!rows || rows.length === 0) {
      try {
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
        // Cari baris header yang memiliki minimal kolom 'NAMA PELANGGAN' setelah dinormalisasi
        let headerIdx = -1
        for (let i = 0; i < aoa.length; i++) {
          const row = aoa[i] || []
          const normalized = row.map((c) => (typeof c === 'string' ? c : String(c ?? '')))
          const hasName = normalized.some(cell => mapField(cell))
          if (hasName && normalized.some(cell => norm(cell) === 'NAMA PELANGGAN')) {
            headerIdx = i
            break
          }
        }
        if (headerIdx >= 0) {
          const headerRow = (aoa[headerIdx] || []).map((h) => String(h ?? ''))
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
            // push meski kosong; akan disaring di bawah dengan isTrulyEmpty
            collected.push(obj)
          }
          rows = collected
        }
      } catch {
        // ignore fallback error; rows akan tetap kosong dan menghitung 0/0
      }
    }

    let ok = 0, fail = 0
    for (const row of rows) {
      try {
        const r = toTicketRow(row)
        const nama = r.customerName
        // Jika baris benar-benar kosong, lewati tanpa dihitung gagal
        const isTrulyEmpty = Object.values(r).every(v => v === null || v === '' || typeof v === 'undefined')
        if (!nama) { if (!isTrulyEmpty) fail++; continue }
        const customerName = String(nama).trim()
        if (!customerName) { fail++; continue }

        const birthDate = parseDate(r.birthDate || null)
        const locationMap = String(r.locationMap || '')

        const installedDate = parseDate(r.installedDate || null)
        const requestDate = parseDate(r.requestDate) || installedDate
        if (!requestDate) { fail++; continue }

        const pkg = String(r.package ?? '').trim()
        if (!pkg) { fail++; continue }

        const marketingName = String(r.marketingName ?? '').trim()
        if (!marketingName) { fail++; continue }

        const teknisi = String(r.teknisi ?? '').trim() || null
        const pengawalan = String(r.pengawalan ?? '').trim() || null
        const kmz = String(r.kmz ?? '').trim() || null
        const priority = String(r.priority ?? '').trim() || null
        const description = String(r.description ?? '').trim() || null
        const pembayaran = String(r.pembayaran ?? '').trim() || null

        const status = normalizeStatus(r.status) || 'OPEN'
        const phoneNumber = normalizePhoneNumber(r.phoneNumber)

        const fotoRumahRaw = String(r.fotoRumah ?? '').trim()
        const fotoRumah = fotoRumahRaw ? fotoRumahRaw : null
        const hasPhoto = !!fotoRumah

        await prisma.ticket.create({
          data: {
            customerName,
            birthDate,
            locationMap,
            requestDate,
            installedDate,
            package: pkg,
            marketingName,
            teknisi,
            description,
            phoneNumber,
            fotoRumah,
            hasPhoto,
            pengawalan,
            kmz,
            priority,
            pembayaran,
            status: String(status).toUpperCase(),
            statusOrder: statusOrderFor(String(status)),
          }
        })
        ok++
      } catch (e) {
        console.error('Row import error', e)
        fail++
      }
    }

    cache.invalidateByPrefix('tickets-list:')
    cache.invalidateByPrefix('tickets:')
    return NextResponse.json({ message: `Import selesai. Berhasil: ${ok}, Gagal: ${fail}` })
  } catch {
    console.error('Import error')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
