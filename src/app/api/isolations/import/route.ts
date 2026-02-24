import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

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
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(sheet)

    let successCount = 0
    let errorCount = 0

    // Use transaction or createMany? 
    // createMany is faster but strict. Loop allows error handling per row.
    // Given the scale is likely small (hundreds), loop is fine.

    for (const row of jsonData as any[]) {
      try {
        const customerName = row['NAMA PELANGGAN']
        if (!customerName) continue // Skip empty rows

        const userEmail = row['USER']
        const customerPhone = row['NO. HP'] ? String(row['NO. HP']) : null
        const activeDateRaw = row['ACTIVE DATE']
        const activeDate = parseDate(activeDateRaw)
        const reason = row['KETERANGAN']
        const marketing = row['MARKETING']
        
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
            status: 'OPEN',
            isolationDate: new Date(), // Set isolation time to now
            teknisi: session.user.name, // Log who imported it
          }
        })
        successCount++
      } catch (e) {
        console.error('Row import error:', e)
        errorCount++
      }
    }

    return NextResponse.json({ 
      message: `Import selesai. Berhasil: ${successCount}, Gagal: ${errorCount}`,
      successCount,
      errorCount
    })
    
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
