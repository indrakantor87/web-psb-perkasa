import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { jakartaDateFromDMY, jakartaDateFromExcelSerial } from '@/lib/jakarta-time'
// Note: use dynamic import for 'xlsx' to avoid bundling issues on Vercel

export const runtime = 'nodejs'

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
    let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

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
      pengawalan?: unknown
      kmz?: unknown
      priority?: unknown
      description?: unknown
      pembayaran?: unknown
      status?: unknown
      phoneNumber?: unknown
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
        const birth = r.birthDate || null
        const maps = r.locationMap || ''
        const req = r.requestDate
        const install = r.installedDate || null
        const paket = r.package || 'HOME BASIC'
        const marketing = r.marketingName || session.user.name
        const pengawalan = r.pengawalan || null
        const kmz = r.kmz || null
        const priority = r.priority || null
        const ket = r.description || null
        const pay = r.pembayaran || null
        // Semua data impor dari Excel dianggap sudah selesai (CLOSE)
        const status = 'CLOSE'
        const phone = r.phoneNumber || ''
        const installedDate = parseDate(install)
        if (!installedDate) { fail++; continue }
        const requestDate = parseDate(req) || installedDate

        await prisma.ticket.create({
          data: {
            customerName: String(nama),
            birthDate: parseDate(birth),
            locationMap: String(maps || ''),
            requestDate,
            installedDate,
            package: String(paket),
            marketingName: String(marketing),
            teknisi: null,
            description: ket ? String(ket) : null,
            phoneNumber: String(phone || ''),
            fotoRumah: null,
            hasPhoto: false,
            pengawalan: pengawalan ? String(pengawalan) : null,
            kmz: kmz ? String(kmz) : null,
            priority: priority ? String(priority) : null,
            pembayaran: pay ? String(pay) : null,
            status: String(status).toUpperCase(),
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
