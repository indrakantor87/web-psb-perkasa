import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'

export const runtime = 'nodejs'

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
    
    // Convert to AOA to find headers
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
    
    const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : '')
    
    const mapField = (cell: unknown) => {
      const k = norm(cell)
      if (['NAMA AREA', 'AREA', 'NAMA'].includes(k)) return 'name'
      if (['KETERANGAN', 'DESCRIPTION', 'NOTES', 'KET'].includes(k)) return 'description'
      return null
    }

    let headerIdx = -1
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      if (aoa[i].some(cell => mapField(cell) === 'name')) {
        headerIdx = i
        break
      }
    }

    if (headerIdx === -1) {
      return NextResponse.json({ error: 'Kolom "Nama Area" tidak ditemukan' }, { status: 400 })
    }

    const headerRow = aoa[headerIdx]
    const fieldMap: Record<number, string> = {}
    headerRow.forEach((cell, idx) => {
      const field = mapField(cell)
      if (field) fieldMap[idx] = field
    })

    let ok = 0, fail = 0
    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const row = aoa[i]
      const data: any = {}
      let hasName = false

      Object.entries(fieldMap).forEach(([idx, field]) => {
        const val = row[Number(idx)]
        if (val !== null && val !== undefined && val !== '') {
          data[field] = String(val).trim()
          if (field === 'name') hasName = true
        }
      })

      if (!hasName) continue

      try {
        await prisma.coveredArea.upsert({
          where: { name: data.name },
          update: { description: data.description || null },
          create: { name: data.name, description: data.description || null }
        })
        ok++
      } catch (e) {
        console.error('Import row error:', e)
        fail++
      }
    }

    cache.invalidateByPrefix('covered-areas:')
    return NextResponse.json({ message: `Import selesai. Berhasil: ${ok}, Gagal: ${fail}` })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
