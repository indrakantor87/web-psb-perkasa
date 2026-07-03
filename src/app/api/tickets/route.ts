import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { ticketCreateSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { cache } from '@/lib/cache'
import { jakartaMonthRange, jakartaNow, JAKARTA_OFFSET_MS } from '@/lib/jakarta-time'
import { isSyntheticMarketingLabel, normalizeMarketingName, toDisplayMarketingName } from '@/lib/marketing-users'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'

export const dynamic = 'force-dynamic'

async function repairTicketIdSequence() {
  await prisma.$executeRaw`
    SELECT setval(
      pg_get_serial_sequence('"Ticket"', 'id'),
      COALESCE((SELECT MAX(id) FROM "Ticket"), 0) + 1,
      false
    );
  `
}

function isTicketIdUniqueError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2002') return false
  const meta = (error.meta ?? {}) as { target?: unknown }
  const target = meta.target
  if (Array.isArray(target)) return target.includes('id')
  return target === 'id'
}

export async function GET(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'list')
  if (accessError) return accessError
  const activeSession = requireSession(session)

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const statusRaw = searchParams.get('status')
  const search = searchParams.get('search')
  const all = searchParams.get('all') === '1'
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('limit') || '25')
  const status = statusRaw === 'PENDING' ? 'ON_PROGRESS' : statusRaw

  const and: Prisma.TicketWhereInput[] = []

  // Handle Search
  if (search && search.trim()) {
    const searchTrimmed = search.trim()
    const searchInt = parseInt(searchTrimmed, 10)
    const isNum = !Number.isNaN(searchInt)

    const searchOr: Prisma.TicketWhereInput[] = [
      { customerName: { contains: searchTrimmed, mode: 'insensitive' } },
      { pengawalan: { contains: searchTrimmed, mode: 'insensitive' } },
    ]
    if (isNum) searchOr.push({ id: searchInt })
    and.push({ OR: searchOr })
  }

  // Filter for Marketing role
  if (activeSession.user.role === 'MARKETING') {
    and.push({
      marketingName: {
        equals: normalizeMarketingName(activeSession.user.name),
        mode: 'insensitive',
      },
    })
  } else {
    const marketingParam = searchParams.get('marketing')
    if (marketingParam && marketingParam.trim()) {
      and.push({ marketingName: { contains: marketingParam.trim() } })
    }
  }

  if (month && year) {
    const y = parseInt(year)
    const m = parseInt(month)
    const { start: startDate, end: endDate } = jakartaMonthRange(y, m)
    const now = jakartaNow()
    const isSelectedCurrentMonth = now.getFullYear() === y && (now.getMonth() + 1) === m
    const openStatuses = ['OPEN', 'ON_PROGRESS']
    
    // Aturan:
    // - Selalu tampilkan tiket terpasang (installedDate) sesuai bulan pemasangan
    // - Jika melihat bulan saat ini: tampilkan juga semua tiket yang BELUM terpasang dan masih open dari bulan-bulan sebelumnya (carry-over)
    // - Jika melihat bulan lampau: JANGAN tampilkan tiket belum terpasang (semua tiket open dipindah tampil ke bulan berjalan)
    const or: Prisma.TicketWhereInput[] = [
      {
        AND: [{ installedDate: { not: null } }, { installedDate: { gte: startDate, lt: endDate } }],
      },
    ]
    if (isSelectedCurrentMonth) {
      or.push({
        AND: [{ installedDate: null }, { status: { in: openStatuses } }, { requestDate: { lt: endDate } }],
      })
    }
    and.push({ OR: or })
  } else if (year) {
      const y = parseInt(year)
      const startDate = new Date(Date.UTC(y, 0, 1) - JAKARTA_OFFSET_MS)
      const endDate = new Date(Date.UTC(y + 1, 0, 1) - JAKARTA_OFFSET_MS)
      and.push({
        OR: [
          { AND: [{ installedDate: { not: null } }, { installedDate: { gte: startDate, lt: endDate } }] },
          { AND: [{ installedDate: null }, { requestDate: { gte: startDate, lt: endDate } }] },
        ],
      })
  }

  if (status && status !== 'ALL') {
    and.push({ status })
  }

  try {
    const where: Prisma.TicketWhereInput = and.length ? { AND: and } : {}
    const selectFull = {
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
      hasPhoto: true,
      closedBy: {
        select: {
          name: true,
          role: true
        }
      }
    } satisfies Prisma.TicketSelect

    const selectMinimal = {
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
      closedBy: {
        select: {
          name: true,
          role: true
        }
      }
    } satisfies Prisma.TicketSelect

    const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
      { requestDate: 'desc' }
    ]

    const skip = (page - 1) * pageSize

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy,
      select: selectFull,
      ...(all ? {} : { skip, take: pageSize }),
    }).catch(async () => {
      try {
        const rows = await prisma.ticket.findMany({
          where,
          orderBy,
          select: selectMinimal,
          ...(all ? {} : { skip, take: pageSize }),
        })
        return rows.map((t) => ({ ...t, pembayaran: null, hasPhoto: false }))
      } catch {
        const selectMinimalNoRelation = { ...selectMinimal, closedBy: undefined } as unknown as Prisma.TicketSelect
        const rows = await prisma.ticket.findMany({
          where,
          orderBy,
          select: selectMinimalNoRelation,
          ...(all ? {} : { skip, take: pageSize }),
        })
        return rows.map((t) => ({ ...t, closedBy: null, pembayaran: null, hasPhoto: false }))
      }
    })

    const sanitizedTickets = tickets.map((ticket) => ({
      ...ticket,
      marketingName: toDisplayMarketingName(ticket.marketingName),
    }))

    return NextResponse.json(sanitizedTickets, {
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'input')
  if (accessError) return accessError
  const activeSession = requireSession(session)
  
  try {
    const formData = await request.formData()
    const file = formData.get('fotoRumah') as File | null

    let fotoRumahPath = null

    if (file && file.size > 0) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg']
      if (!validTypes.includes(file.type)) {
        console.error('Invalid file type:', file.type)
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
      }

      if (file.size > 3 * 1024 * 1024) {
        console.error('File too large:', file.size)
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
      marketingName: activeSession.user.role === 'MARKETING' ? activeSession.user.name : (formData.get('marketingName') || undefined),
      description: formData.get('description') || undefined,
      phoneNumber: formData.get('phoneNumber'),
      pengawalan: formData.get('pengawalan') || undefined,
      fotoRumah: fotoRumahPath,
    }

    console.log('Raw Data:', JSON.stringify({ ...rawData, fotoRumah: '...base64...' }))

    const result = ticketCreateSchema.safeParse(rawData)
    if (!result.success) {
      console.error('Validation failed:', result.error.flatten())
      return NextResponse.json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 })
    }

    const {
      customerName,
      birthDate: birthDateStr,
      locationMap,
      package: pkg,
      marketingName: submittedMarketingName,
      description,
      phoneNumber,
      pengawalan
    } = result.data

    // Only allow authorized roles to set pengawalan initially
    const canSetPengawalan = ['ADMIN', 'CS', 'NOC'].includes(activeSession.user.role)
    const finalPengawalan = canSetPengawalan ? pengawalan : null

    const finalMarketingName =
      activeSession.user.role === 'MARKETING'
        ? normalizeMarketingName(activeSession.user.name)
        : normalizeMarketingName(submittedMarketingName)

    if (!finalMarketingName || (activeSession.user.role !== 'MARKETING' && isSyntheticMarketingLabel(finalMarketingName))) {
        return NextResponse.json({ error: 'Marketing name is required' }, { status: 400 })
    }

    // Validate birthDate is a valid date
    const birthDateObj = new Date(birthDateStr)
    if (isNaN(birthDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid birthDate format' }, { status: 400 })
    }

    // Create ticket using standard Prisma create
    const createData: Prisma.TicketCreateInput = {
      customerName,
      birthDate: birthDateObj,
      locationMap,
      package: pkg,
      marketingName: finalMarketingName,
      description,
      phoneNumber,
      pengawalan: finalPengawalan,
      fotoRumah: fotoRumahPath,
      hasPhoto: !!fotoRumahPath,
      status: 'OPEN',
      requestDate: new Date(),
    }

    let ticket
    try {
      ticket = await prisma.ticket.create({ data: createData })
    } catch (e) {
      if (!isTicketIdUniqueError(e)) throw e
      await repairTicketIdSequence()
      ticket = await prisma.ticket.create({ data: createData })
    }

    cache.invalidateByPrefix('tickets-list:')
    cache.invalidateByPrefix('tickets:')
    return NextResponse.json(ticket, { status: 201 })
  } catch (error: unknown) {
    console.error(error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message || 'Failed to create ticket' }, { status: 500 })
  }
}
