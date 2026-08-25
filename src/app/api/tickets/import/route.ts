import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { jakartaDateFromDMY, jakartaDateFromExcelSerial } from '@/lib/jakarta-time'
import { normalizeMarketingName, resolveMarketingName, EMPTY_MARKETING_LABEL } from '@/lib/marketing-users'
import { canImportListTickets } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'

export const runtime = 'nodejs'

function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date && !isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    return jakartaDateFromExcelSerial(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parts = trimmed.split(/[\/\-\.]/)
    if (parts.length === 3) {
      const [d, m, y] = parts.map(p => parseInt(p, 10))
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        const year = y < 100 ? 2000 + y : y
        return jakartaDateFromDMY(d, m, year)
      }
    }
    const dt = new Date(trimmed)
    if (isNaN(dt.getTime())) return null
    return jakartaDateFromDMY(dt.getDate(), dt.getMonth() + 1, dt.getFullYear())
  }
  return null
}

function normalizeStatus(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ')
  if (!raw) return 'OPEN'
  if (raw.includes('CLOSE') || raw.includes('CLOSED') || raw.includes('SELESAI') || raw === 'DONE') return 'CLOSE'
  if (raw.includes('PROGRESS') || raw.includes('PROSES') || raw.includes('SEDANG BERJALAN') || raw.includes('PENDING')) return 'ON_PROGRESS'
  if (raw.includes('OPEN') || raw.includes('BUKA') || raw.includes('BARU')) return 'OPEN'
  return 'OPEN'
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canImportListTickets(session.user.role)) {
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

    const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : '')
    const mapField = (key: string) => {
      const k = norm(key)
      if (['NAMA PELANGGAN','NAMA','CUSTOMER','NAMA CUSTOMER'].includes(k)) return 'customerName'
      if (['TANGGAL LAHIR','TGL LAHIR','BIRTH DATE','BIRTHDATE'].includes(k)) return 'birthDate'
      if (['MAPS LOKASI','LOKASI MAPS','LOKASI','MAPS','LOCATION MAP','ALAMAT','ADDRESS'].includes(k)) return 'locationMap'
      if (['TGL REQUEST','TANGGAL REQUEST','REQUEST DATE','TGL PENDAFTARAN','TANGGAL PENDAFTARAN'].includes(k)) return 'requestDate'
      if (['TGL TERPASANG','TANGGAL PASANG','INSTALLED DATE','INSTALL DATE','TANGGAL INSTALL','TGL INSTALL'].includes(k)) return 'installedDate'
      if (['PAKET','PACKAGE','LAYANAN'].includes(k)) return 'package'
      if (['MARKETING','NAMA MARKETING','SALES','SALES MARKETING','PEMASAR','PEMASARAN'].includes(k)) return 'marketingName'
      if (['FOTO RUMAH','FOTO','PHOTO','PHOTO HOUSE','FOTO CUSTOMER','RUMAH'].includes(k)) return 'fotoRumah'
      if (['PENGAWALAN','PENGAMANAN','GUARD'].includes(k)) return 'pengawalan'
      if (['KMZ'].includes(k)) return 'kmz'
      if (['PRIORITAS','PRIORITY','TINGKAT PRIORITAS'].includes(k)) return 'priority'
      if (['KETERANGAN','CATATAN','DESCRIPTION','NOTES','CATAT'].includes(k)) return 'description'
      if (['PEMBAYARAN','PAYMENT','METODE BAYAR','CARA BAYAR'].includes(k)) return 'pembayaran'
      if (['STATUS','STATE'].includes(k)) return 'status'
      if (['NO HP','NO TELP','NO TELEPON','NO WA','WA','NO WA AKTIF','NOHP','PHONE','TELEPON','HANDPHONE','HP','KONTAK'].includes(k)) return 'phoneNumber'
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
      fotoRumah?: unknown
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

    if (!rows || rows.length === 0) {
      try {
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
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
            collected.push(obj)
          }
          rows = collected
        }
      } catch {
        // ignore
      }
    }

    let ok = 0, fail = 0
    for (const row of rows) {
      try {
        const r = toTicketRow(row)
        const nama = r.customerName
        const isTrulyEmpty = Object.values(r).every(v => v === null || v === '' || typeof v === 'undefined')
        if (!nama) { if (!isTrulyEmpty) fail++; continue }
        const birth = r.birthDate || null
        const maps = r.locationMap || ''
        const req = r.requestDate
        const install = r.installedDate || null
        const paket = r.package || 'HOME BASIC'
        const marketing = r.marketingName
        const fotoRumah = r.fotoRumah || null
        const pengawalan = r.pengawalan || null
        const kmz = r.kmz || null
        const priority = r.priority || null
        const ket = r.description || null
        const pay = r.pembayaran || null
        const statusRaw = r.status
        const status = normalizeStatus(statusRaw)
        const phone = r.phoneNumber || ''

        const installedDate = parseDate(install)
        let requestDate = parseDate(req)
        if (!requestDate) {
          requestDate = installedDate ?? jakartaDateFromDMY(new Date().getDate(), new Date().getMonth() + 1, new Date().getFullYear())
        }

        let finalMarketingName = await resolveMarketingName(marketing)
        if (!finalMarketingName) {
          const rawNormalized = normalizeMarketingName(marketing)
          finalMarketingName = rawNormalized || EMPTY_MARKETING_LABEL
        }

        const fotoRumahStr = fotoRumah ? String(fotoRumah).trim() : null

        await prisma.ticket.create({
          data: {
            customerName: String(nama),
            birthDate: parseDate(birth),
            locationMap: String(maps || ''),
            requestDate,
            installedDate,
            package: String(paket),
            marketingName: finalMarketingName,
            teknisi: null,
            description: ket ? String(ket) : null,
            phoneNumber: String(phone || ''),
            fotoRumah: fotoRumahStr,
            hasPhoto: !!fotoRumahStr,
            pengawalan: pengawalan ? String(pengawalan) : null,
            kmz: kmz ? String(kmz) : null,
            priority: priority ? String(priority) : null,
            pembayaran: pay ? String(pay) : null,
            status,
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
  } catch (e) {
    console.error('Import error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
