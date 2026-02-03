import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { ticketCreateSchema } from '@/lib/validations'

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
  } else {
    const marketingParam = searchParams.get('marketing')
    if (marketingParam && marketingParam.trim()) {
      where.marketingName = {
        contains: marketingParam.trim(),
      }
    }
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
    // Optimasi: Fetch data tiket tanpa kolom fotoRumah yang berat
    // Dan fetch ID tiket yang punya foto secara terpisah
    const [tickets, ticketsWithPhotos] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: {
          requestDate: 'desc',
        },
        select: {
          id: true,
          customerName: true,
          birthDate: true,
          locationMap: true,
          requestDate: true,
          installedDate: true,
          package: true,
          marketingName: true,
          description: true,
          phoneNumber: true,
          pengawalan: true,
          kmz: true,
          priority: true,
          status: true,
          pembayaran: true,
          closedBy: {
            select: {
              name: true,
              role: true
            }
          }
        }
      }),
      prisma.ticket.findMany({
        where: {
          ...where,
          fotoRumah: {
            not: null
          }
        },
        select: {
          id: true
        }
      })
    ])

    const photoIds = new Set(ticketsWithPhotos.map(t => t.id))

    const formattedTickets = tickets.map(t => ({
      ...t,
      hasPhoto: photoIds.has(t.id)
    }))

    return NextResponse.json(formattedTickets)
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
    const file = formData.get('fotoRumah') as File | null

    let fotoRumahPath = null

    if (file && file.size > 0) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg']
      if (!validTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
      }

      if (file.size > 3 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large' }, { status: 400 })
      }

      // Fallback to Base64 (Google Drive integration removed)
      const buffer = Buffer.from(await file.arrayBuffer())
      fotoRumahPath = `data:${file.type};base64,${buffer.toString('base64')}`
    }

    const rawData = {
      customerName: formData.get('customerName'),
      birthDate: formData.get('birthDate'),
      locationMap: formData.get('locationMap'),
      package: formData.get('package'),
      marketingName: session.user.role === 'MARKETING' ? session.user.name : formData.get('marketingName'),
      description: formData.get('description'),
      phoneNumber: formData.get('phoneNumber'),
      pengawalan: formData.get('pengawalan'),
      fotoRumah: fotoRumahPath,
    }

    const result = ticketCreateSchema.safeParse(rawData)
    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 })
    }

    const {
      customerName,
      birthDate: birthDateStr,
      locationMap,
      package: pkg,
      marketingName: finalMarketingName,
      description,
      phoneNumber,
      pengawalan
    } = result.data

    // Only allow authorized roles to set pengawalan initially
    const canSetPengawalan = ['ADMIN', 'CS', 'NOC'].includes(session.user.role)
    const finalPengawalan = canSetPengawalan ? pengawalan : null

    // Ensure marketingName is present (it should be handled by validation or logic above, but for type safety)
    if (!finalMarketingName) {
        return NextResponse.json({ error: 'Marketing name is required' }, { status: 400 })
    }

    // Validate birthDate is a valid date
    const birthDateObj = new Date(birthDateStr)
    if (isNaN(birthDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid birthDate format' }, { status: 400 })
    }

    // Create ticket using standard Prisma create
    const ticket = await prisma.ticket.create({
      data: {
        customerName,
        birthDate: birthDateObj,
        locationMap,
        package: pkg,
        marketingName: finalMarketingName,
        description,
        phoneNumber,
        pengawalan: finalPengawalan,
        fotoRumah: fotoRumahPath,
        status: 'OPEN',
        requestDate: new Date(),
      },
    })

    return NextResponse.json(ticket)
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message || 'Failed to create ticket' }, { status: 500 })
  }
}
