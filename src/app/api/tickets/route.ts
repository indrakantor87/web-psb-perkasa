import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const status = searchParams.get('status')

  const where: any = {}

  // Filter for Marketing role
  if (session.user.role === 'MARKETING') {
    where.marketingName = session.user.name
  }

  if (month && year) {
    const startDate = new Date(`${year}-${month}-01`)
    const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1))
    
    where.requestDate = {
      gte: startDate,
      lt: endDate,
    }
  } else if (year) {
      const startDate = new Date(`${year}-01-01`)
      const endDate = new Date(`${parseInt(year) + 1}-01-01`)
      where.requestDate = {
        gte: startDate,
        lt: endDate,
      }
  }

  if (status) {
    where.status = status
  }

  try {
    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: {
        requestDate: 'desc',
      },
      include: {
        closedBy: {
          select: {
            name: true,
            role: true
          }
        }
      }
    })

    return NextResponse.json(tickets)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // All roles can create tickets EXCEPT TEKNISI
  if (session.user.role === 'TEKNISI') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }
  
  try {
    const formData = await request.formData()
    const customerName = formData.get('customerName') as string
    const locationMap = formData.get('locationMap') as string
    const pkg = formData.get('package') as string
    const marketingName = formData.get('marketingName') as string
    const description = formData.get('description') as string
    const phoneNumber = formData.get('phoneNumber') as string
    const birthDateStr = formData.get('birthDate') as string
    const pengawalan = formData.get('pengawalan') as string
    const file = formData.get('fotoRumah') as File | null

    let fotoRumahPath = null

    if (file && file.size > 0) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg']
      if (!validTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
      }

      // Validate size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large' }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const base64 = buffer.toString('base64')
      fotoRumahPath = `data:${file.type};base64,${base64}`
    }

    // Enforce marketingName for Marketing role
    const finalMarketingName = session.user.role === 'MARKETING' ? session.user.name : marketingName

    // Validate mandatory fields
    if (!customerName || !phoneNumber || !pkg || !finalMarketingName || !locationMap || !fotoRumahPath) {
      return NextResponse.json({ 
        error: 'Missing required fields: customerName, phoneNumber, package, marketingName, locationMap, fotoRumah' 
      }, { status: 400 })
    }

    // Only allow authorized roles to set pengawalan initially
    const canSetPengawalan = ['ADMIN', 'CS', 'NOC'].includes(session.user.role)
    const finalPengawalan = canSetPengawalan ? pengawalan : null

    // Create ticket without fotoRumah first to avoid Prisma Client validation errors if schema is out of sync
    const ticket = await prisma.ticket.create({
      data: {
        customerName,
        birthDate: new Date(birthDateStr),
        locationMap,
        package: pkg,
        marketingName: finalMarketingName,
        description,
        phoneNumber,
        // pengawalan: finalPengawalan, // Commented out to prevent error with outdated Prisma Client
        // fotoRumah: fotoRumahPath, // Commented out to prevent error with outdated Prisma Client
        status: 'OPEN',
        requestDate: new Date(),
      } as any,
    })

    // Manually update fotoRumah and pengawalan using raw query
    if (fotoRumahPath || finalPengawalan) {
      try {
        const updates = []
        if (fotoRumahPath) updates.push(`fotoRumah = '${fotoRumahPath}'`)
        if (finalPengawalan) updates.push(`pengawalan = '${finalPengawalan}'`)
        
        if (updates.length > 0) {
          // Note: Using template literals directly in raw query is risky for SQL injection, 
          // but Prisma $executeRaw supports parameter substitution.
          // However, combining multiple dynamic updates is tricky with tagged templates.
          // Let's do separate updates for safety.
          
          if (fotoRumahPath) {
             await prisma.$executeRaw`UPDATE Ticket SET fotoRumah = ${fotoRumahPath} WHERE id = ${ticket.id}`
             ;(ticket as any).fotoRumah = fotoRumahPath
          }
          if (finalPengawalan) {
             await prisma.$executeRaw`UPDATE Ticket SET pengawalan = ${finalPengawalan} WHERE id = ${ticket.id}`
             ;(ticket as any).pengawalan = finalPengawalan
          }
        }
      } catch (e) {
        console.error('Failed to update extra fields via raw query:', e)
      }
    }

    return NextResponse.json(ticket)
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message || 'Failed to create ticket' }, { status: 500 })
  }
}
