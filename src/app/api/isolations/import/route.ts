import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
// Avoid bundling issues on Vercel by dynamically importing 'xlsx'

// Helper to parse DD/MM/YYYY or Excel serial date
function parseDate(dateStr: string | number): Date | null {
  if (!dateStr) return null
  
  // Handle Excel serial date number
  if (typeof dateStr === 'number') {
    // Excel base date is 1899-12-30. JS is 1970-01-01.
    // Excel serial 1 = 1900-01-01 (but Excel thinks 1900 is leap year, bug)
    // 25569 is diff between 1970-01-01 and 1900-01-01
    return new Date(Math.round((dateStr - 25569) * 86400 * 1000))
  }

  if (typeof dateStr === 'string') {
    // Try DD/MM/YYYY
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const year = parseInt(parts[2], 10)
      return new Date(year, month, day)
    }
  }
  
  return new Date(dateStr)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Allow only ADMIN, NOC, CS? Or anyone with access?
  // Let's allow those who can access Isolir page usually.
  
  try {
    const XLSXModule = await import('xlsx')
    const XLSX: any = (XLSXModule as any).default || XLSXModule
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null })

    let successCount = 0
    let errorCount = 0
    const errorDetails: string[] = []

    // Use transaction or createMany? 
    // createMany is faster but strict. Loop allows error handling per row.
    // Given the scale is likely small (hundreds), loop is fine.

    // Header normalization helpers
    const norm = (s: any) =>
      (typeof s === 'string'
        ? s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ')
        : s) as string
    const mapField = (key: string) => {
      const k = norm(key)
      if (['NAMA PELANGGAN', 'NAMA', 'CUSTOMER', 'PELAGGAN', 'CUSTOMER NAME'].includes(k)) return 'customerName'
      if (['USER', 'EMAIL', 'ID PELANGGAN', 'USER EMAIL'].includes(k)) return 'userEmail'
      if (['NO HP', 'NOHP', 'NO TELP', 'NO TELPON', 'NO HP AKTIF', 'NOHP AKTIF', 'NO HP PELANGGAN', 'NO HP PEL'].includes(k)) return 'customerPhone'
      if (['ACTIVE DATE', 'AKTIF', 'TANGGAL AKTIF', 'TGL AKTIF', 'START DATE', 'AKTIVE DATE'].includes(k)) return 'activeDate'
      if (['KETERANGAN', 'ALASAN', 'REASON', 'CATATAN'].includes(k)) return 'reason'
      if (['MARKETING', 'SALES', 'PIC MARKETING', 'PIC'].includes(k)) return 'marketing'
      if (['RADBOOX', 'RADBOX', 'RADBOOK', 'RADBOOX AREA'].includes(k)) return 'radboox'
      return ''
    }

    const toIsoRow = (row: Record<string, any>) => {
      const out: any = {}
      for (const [k, v] of Object.entries(row)) {
        const f = mapField(k)
        if (f) out[f] = v
      }
      return out
    }

    for (const [idx, row] of (jsonData as any[]).entries()) {
      try {
        const r = toIsoRow(row)
        const customerName = r.customerName
        if (!customerName) continue // Skip empty rows

        const userEmail = r.userEmail
        const customerPhone = r.customerPhone ? String(r.customerPhone) : null
        const activeDateRaw = r.activeDate
        const activeDate = parseDate(activeDateRaw)
        const reason = r.reason
        const marketing = r.marketing
        const radboox = r.radboox ? String(r.radboox) : null
        
        // Check if already exists? Maybe based on customerName?
        // For now, let's just insert. If duplicates are an issue, we can check.
        // But user asked to "import", implying adding data.
        
        await prisma.isolation.create({
          data: {
            customerName: String(customerName),
            userEmail: userEmail ? String(userEmail) : null,
            customerPhone: customerPhone,
            activeDate: activeDate,
            reason: reason ? String(reason) : null,
            marketing: marketing ? String(marketing) : null,
            radboox: radboox,
            status: 'OPEN',
            isolationDate: new Date(), // Set isolation time to now
            teknisi: session.user.name, // Log who imported it
          }
        })
        successCount++
      } catch (e) {
        console.error('Row import error:', e)
        errorCount++
        if (errorDetails.length < 5) {
          errorDetails.push(`Baris ${idx + 2}: ${String((e as Error).message || e)}`)
        }
      }
    }

    return NextResponse.json({ 
      message: `Import selesai. Berhasil: ${successCount}, Gagal: ${errorCount}`,
      successCount,
      errorCount,
      errors: errorDetails
    })
    
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
