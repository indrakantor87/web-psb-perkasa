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
    let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

    const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : '')
    
    const mapField = (key: string) => {
      const k = norm(key)
      if (['TANGGAL', 'DATE', 'TGL', 'WAKTU'].includes(k)) return 'date'
      if (['NAMA MARKETING', 'MARKETING', 'SALES', 'NAMA', 'USER', 'PETUGAS'].includes(k)) return 'marketingName'
      if (['AKTIVITAS', 'ACTIVITY', 'KEGIATAN', 'PEKERJAAN', 'HASIL', 'PROGRESS'].includes(k)) return 'activity'
      if (['KETERANGAN', 'NOTES', 'NOTE', 'CATATAN', 'KET'].includes(k)) return 'notes'
      return ''
    }

    // Dynamic header detection (fallback)
    if (!rows || rows.length === 0 || !rows.some(r => Object.keys(r).some(k => mapField(k)))) {
      try {
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
        let headerIdx = -1
        // Scan up to first 20 rows for header
        for (let i = 0; i < Math.min(aoa.length, 20); i++) {
          const row = aoa[i] || []
          const normalized = row.map((c) => norm(c))
          if (normalized.some(cell => mapField(cell))) {
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
            const rowData = aoa[r] || []
            const obj: Record<string, unknown> = {}
            let hasData = false
            Object.entries(indexMap).forEach(([idxStr, field]) => {
              const idx = Number(idxStr)
              const val = rowData[idx]
              obj[field] = val ?? null
              if (val !== null && val !== '') hasData = true
            })
            if (hasData) collected.push(obj)
          }
          rows = collected
        }
      } catch (err) {
        console.error('Fallback detection error:', err)
      }
    }

    let areas: any[] = []
    try {
      areas = await prisma.coveredArea.findMany()
    } catch (e) {
      console.error('Failed to fetch areas for import', e)
    }

    let ok = 0, fail = 0
    let lastError = ''

    for (const row of rows) {
      try {
        const mapped: any = {}
        
        // Check if row already has the fields (from fallback)
        if (row.marketingName || row.activity || row.date) {
          Object.assign(mapped, row)
        } else {
          // Map from keys
          for (const [k, v] of Object.entries(row)) {
            const field = mapField(k)
            if (field) mapped[field] = v
          }
        }

        const isTrulyEmpty = Object.values(mapped).every(v => v === null || v === '' || typeof v === 'undefined')
        if (isTrulyEmpty) continue

        // Required field: activity or marketingName
        if (!mapped.activity && !mapped.marketingName) {
           continue
        }

        // Try to match areaId from activity text if possible
        let areaId = null
        if (mapped.activity && areas.length > 0) {
          const act = norm(mapped.activity)
          const found = areas.find(a => act.includes(norm(a.name)))
          if (found) areaId = found.id
        }

        await prisma.marketingActivity.create({
          data: {
            date: parseDate(mapped.date) || new Date(),
            marketingName: String(mapped.marketingName || '-').trim(),
            activity: String(mapped.activity || '-').trim(),
            notes: mapped.notes ? String(mapped.notes).trim() : null,
            areaId: areaId
          }
        })
        ok++
      } catch (e: any) {
        console.error('Row import error:', e)
        fail++
        lastError = e.message || String(e)
      }
    }

    cache.invalidateByPrefix('marketing-activities:')
    let message = `Import selesai. Berhasil: ${ok}, Gagal: ${fail}`
    if (fail > 0 && ok === 0) {
      message += `. Error terakhir: ${lastError}`
    }
    return NextResponse.json({ message })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
