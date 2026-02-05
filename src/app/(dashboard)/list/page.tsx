import { TicketList } from '@/components/TicketList'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const resolvedSearchParams = await searchParams
  const monthParam = resolvedSearchParams.month
  const yearParam = resolvedSearchParams.year
  const statusParam = resolvedSearchParams.status
  const marketingParam = resolvedSearchParams.marketing
  const searchParam = resolvedSearchParams.search
  const limitParam = resolvedSearchParams.limit

  const now = new Date()
  const currentMonth = typeof monthParam === 'string' ? parseInt(monthParam) : now.getMonth() + 1
  const currentYear = typeof yearParam === 'string' ? parseInt(yearParam) : now.getFullYear()
  const currentStatus = typeof statusParam === 'string' ? statusParam.toUpperCase() : 'ALL'
  const currentMarketing = typeof marketingParam === 'string' ? marketingParam : ''
  const currentSearch = typeof searchParam === 'string' ? searchParam : ''

  const startDate = new Date(currentYear, currentMonth - 1, 1)
  const endDate = new Date(currentYear, currentMonth, 1)

  const baseWhere: any = {
    requestDate: {
      gte: startDate,
      lt: endDate,
    },
  }

  if (session.user.role === 'MARKETING') {
    baseWhere.marketingName = session.user.name
  } else if (currentMarketing && currentMarketing.trim()) {
    baseWhere.marketingName = {
      contains: currentMarketing.trim(),
    }
  }

  if (currentSearch && currentSearch.trim()) {
    const searchTrimmed = currentSearch.trim()
    const searchInt = parseInt(searchTrimmed)
    const isNum = !isNaN(searchInt)

    baseWhere.OR = [
      { customerName: { contains: searchTrimmed, mode: 'insensitive' } },
      { pengawalan: { contains: searchTrimmed, mode: 'insensitive' } },
    ]

    if (isNum) {
      baseWhere.OR.push({ id: searchInt })
    }
  }

  const where = { ...baseWhere }
  if (currentStatus !== 'ALL') {
    where.status = currentStatus
  }

  const pageParam = resolvedSearchParams.page
  const currentPageNumber = typeof pageParam === 'string' ? parseInt(pageParam) : 1
  const pageSize = typeof limitParam === 'string' ? parseInt(limitParam) : 25

  const [tickets, totalCount, groupedCountsRaw, photoTickets, priorities, defaultTemplate] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: [
        // { statusOrder: 'asc' }, // Disabled until server restart
        { requestDate: 'desc' },
        { installedDate: { sort: 'desc', nulls: 'last' } }
      ],
      skip: (currentPageNumber - 1) * pageSize,
      take: pageSize,
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
        // fotoRumah: true, // REMOVED for performance (base64 too large)
        closedBy: {
          select: {
            name: true,
            role: true
          }
        }
      }
    }),
    prisma.ticket.count({ where }),
    // Optimization: Fetch all status counts in one query using groupBy
    session.user.role !== 'MARKETING' 
      ? prisma.ticket.groupBy({
          by: ['status'],
          _count: {
            status: true
          },
          where: baseWhere
        })
      : Promise.resolve([]),
    // Optimization: Fetch IDs of tickets with photos separately
    prisma.ticket.findMany({
      where: {
        ...where,
        fotoRumah: { not: null }
      },
      select: { id: true },
      skip: (currentPageNumber - 1) * pageSize,
      take: pageSize,
    }),
    // Fetch priorities for dropdown
    prisma.priority.findMany(),
    // Fetch default template
    prisma.whatsappTemplate.findFirst({
      where: { isDefault: true }
    })
  ])

  // Calculate counts for status badges
  let counts: {
    OPEN: number
    ON_PROGRESS: number
    CLOSE: number
    PENDING: number
  } | undefined = undefined

  if (session.user.role !== 'MARKETING') {
    // Initialize defaults
    counts = { OPEN: 0, ON_PROGRESS: 0, CLOSE: 0, PENDING: 0 }
    
    // Map groupBy results to counts object
    const groupedCounts = groupedCountsRaw as Array<{ status: string, _count: { status: number } }>
    
    groupedCounts.forEach(item => {
      const status = item.status
      if (counts && status in counts) {
        counts[status as keyof typeof counts] = item._count.status
      }
    })
  }

  // Set of IDs that have photos
  const photoIds = new Set(photoTickets.map(t => t.id))

  // No need for separate photo query anymore
  const formattedTickets = tickets.map(t => ({
    ...t,
    requestDate: t.requestDate.toISOString(),
    installedDate: t.installedDate ? t.installedDate.toISOString() : null,
    birthDate: t.birthDate ? t.birthDate.toISOString() : null,
    hasPhoto: photoIds.has(t.id), // Check against separate ID list
    fotoRumah: null // Ensure we don't pass base64 string even if it was somehow fetched
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PSB Ticket List</h1>
      </div>

      <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
        <div className="p-4 sm:p-6 lg:p-8">
          <TicketList 
            tickets={formattedTickets} 
            userRole={session.user.role}
            initialPeriod={{ month: currentMonth, year: currentYear }}
            initialStatus={currentStatus}
            initialMarketing={currentMarketing}
            initialSearch={currentSearch}
            pagination={{
              currentPage: currentPageNumber,
              totalPages: Math.ceil(totalCount / pageSize),
              totalCount: totalCount,
              pageSize
            }}
            counts={counts}
            priorities={priorities}
            defaultTemplateContent={defaultTemplate?.content || ''}
          />
        </div>
      </div>
    </div>
  )
}
