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

  const now = new Date()
  const currentMonth = typeof monthParam === 'string' ? parseInt(monthParam) : now.getMonth() + 1
  const currentYear = typeof yearParam === 'string' ? parseInt(yearParam) : now.getFullYear()
  const currentStatus = typeof statusParam === 'string' ? statusParam.toUpperCase() : 'ALL'
  const currentMarketing = typeof marketingParam === 'string' ? marketingParam : ''

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

  const where = { ...baseWhere }
  if (currentStatus !== 'ALL') {
    where.status = currentStatus
  }

  const pageParam = resolvedSearchParams.page
  const currentPageNumber = typeof pageParam === 'string' ? parseInt(pageParam) : 1
  const pageSize = 20

  const [tickets, totalCount] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: {
        requestDate: 'desc',
      },
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
        closedBy: {
          select: {
            name: true,
            role: true
          }
        }
      }
    }),
    prisma.ticket.count({ where })
  ])

  // Calculate counts for status badges (always based on baseWhere to show full overview)
  const [open, progress, close, pending] = await Promise.all([
    prisma.ticket.count({ where: { ...baseWhere, status: 'OPEN' } }),
    prisma.ticket.count({ where: { ...baseWhere, status: 'ON_PROGRESS' } }),
    prisma.ticket.count({ where: { ...baseWhere, status: 'CLOSE' } }),
    prisma.ticket.count({ where: { ...baseWhere, status: 'PENDING' } }),
  ])
  
  const counts = { OPEN: open, ON_PROGRESS: progress, CLOSE: close, PENDING: pending }

  // Fetch IDs of tickets that have photos (only for the current page)
  const ticketIds = tickets.map(t => t.id)
  const ticketsWithPhotos = await prisma.ticket.findMany({
    where: {
      id: { in: ticketIds },
      fotoRumah: {
        not: null
      }
    },
    select: {
      id: true
    }
  })

  const photoIds = new Set(ticketsWithPhotos.map(t => t.id))

  const formattedTickets = tickets.map(t => ({
    ...t,
    requestDate: t.requestDate.toISOString(),
    installedDate: t.installedDate ? t.installedDate.toISOString() : null,
    birthDate: t.birthDate ? t.birthDate.toISOString() : null,
    hasPhoto: photoIds.has(t.id)
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Tiket PSB</h1>
      </div>

      <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
        <div className="p-4 sm:p-6 lg:p-8">
          <TicketList 
            tickets={formattedTickets} 
            userRole={session.user.role}
            initialPeriod={{ month: currentMonth, year: currentYear }}
            initialStatus={currentStatus}
            initialMarketing={currentMarketing}
            pagination={{
              currentPage: currentPageNumber,
              totalPages: Math.ceil(totalCount / pageSize),
              totalCount: totalCount
            }}
            counts={counts}
          />
        </div>
      </div>
    </div>
  )
}
