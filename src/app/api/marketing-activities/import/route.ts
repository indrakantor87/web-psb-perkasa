import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'

export const runtime = 'nodejs'

function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof value === 'number') {
    return new Date(Math.round((value - 25569) * 86400 * 1000))
  }
  if (typeof value === 'string') {
    const parts = value.split(/[\/\-]/)
    if (parts.length === 3) {
      const [d, m, y] = parts.map(p => parseInt(p, 10))
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        const year = y < 100 ? 2000 + y : y
        return new Date(year, (m - 1), d)
      }
    }
    const dt = new Date(value)
    return isNaN(dt.getTime()) ? null : dt
  }
  return null
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const isAuthorized = ['ADMIN', 'CS', 'NOC'].includes(session.user.role)
  if (!isAuthorized) {
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
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

    const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : '')
    
    const mapField = (key: string) => {
      const k = norm(key)
      if (['TANGGAL', 'DATE', 'TGL'].includes(k)) return 'date'
      if (['NAMA MARKETING', 'MARKETING', 'SALES', 'NAMA'].includes(k)) return 'marketingName'
      if (['AKTIVITAS', 'ACTIVITY', 'KEGIATAN'].includes(k)) return 'activity'
      if (['KETERANGAN', 'NOTES', 'NOTE', 'CATATAN'].includes(k)) return 'notes'
      return ''
    }

    let ok = 0, fail = 0
    for (const row of rows) {
      try {
        const mapped: any = {}
        for (const [k, v] of Object.entries(row)) {
          const field = mapField(k)
          if (field) mapped[field] = v
        }

        const isTrulyEmpty = Object.values(mapped).every(v => v === null || v === '' || typeof v === 'undefined')
        if (isTrulyEmpty) continue

        if (!mapped.marketingName || !mapped.activity) {
          fail++
          continue
        }

        await prisma.marketingActivity.create({
          data: {
            date: parseDate(mapped.date) || new Date(),
            marketingName: String(mapped.marketingName),
            activity: String(mapped.activity),
            notes: mapped.notes ? String(mapped.notes) : null,
          }
        })
        ok++
      } catch (e) {
        console.error('Row import error', e)
        fail++
      }
    }

    cache.invalidateByPrefix('marketing-activities:')
    return NextResponse.json({ message: `Import selesai. Berhasil: ${ok}, Gagal: ${fail}` })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
