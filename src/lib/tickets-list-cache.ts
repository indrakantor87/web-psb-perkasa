import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import type { Prisma } from '@prisma/client'

export type TicketListRow = {
  id: number
  customerName: string
  birthDate: Date | null
  locationMap: string
  requestDate: Date
  installedDate: Date | null
  package: string
  marketingName: string
  teknisi: string | null
  description: string | null
  phoneNumber: string
  pengawalan: string | null
  kmz: string | null
  priority: string | null
  status: string
  pembayaran: string | null
  hasPhoto: boolean
  closedBy: { name: string; role: string } | null
}

export type TicketListCounts = {
  OPEN: number
  ON_PROGRESS: number
  CLOSE: number
  PENDING: number
}

export const getTicketsListData = unstable_cache(
  async (args: {
    role: string
    userName: string
    month: number
    year: number
    status: string
    marketing: string
    search: string
    page: number
    pageSize: number
  }) => {
    const { role, userName, month, year, status, marketing, search, page, pageSize } = args

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)

    const isSelectedCurrentMonth = (() => {
      const now = new Date()
      return now.getFullYear() === year && (now.getMonth() + 1) === month
    })()
    const openStatuses = ['OPEN', 'ON_PROGRESS', 'PENDING']

    const baseWhereOr: Prisma.TicketWhereInput[] = [
      {
        AND: [{ installedDate: { not: null } }, { installedDate: { gte: startDate, lt: endDate } }],
      },
    ]
    if (isSelectedCurrentMonth) {
      baseWhereOr.push({
        AND: [{ installedDate: null }, { status: { in: openStatuses } }, { requestDate: { lt: endDate } }],
      })
    }

    const baseWhere: Prisma.TicketWhereInput = {
      OR: baseWhereOr,
    }

    if (role === 'MARKETING') {
      baseWhere.marketingName = userName
    } else if (marketing && marketing.trim()) {
      baseWhere.marketingName = {
        contains: marketing.trim(),
      }
    }

    if (search && search.trim()) {
      const searchTrimmed = search.trim()
      const searchInt = parseInt(searchTrimmed, 10)
      const isNum = !Number.isNaN(searchInt)

      baseWhere.OR = [
        { customerName: { contains: searchTrimmed, mode: 'insensitive' } },
        { pengawalan: { contains: searchTrimmed, mode: 'insensitive' } },
      ]

      if (isNum) baseWhere.OR.push({ id: searchInt })
    }

    const where: Prisma.TicketWhereInput = { ...baseWhere }
    if (status && status !== 'ALL') where.status = status

    const [tickets, totalCount, groupedCountsRaw] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: [{ statusOrder: 'asc' }, { requestDate: 'desc' }, { installedDate: { sort: 'desc', nulls: 'last' } }],
        skip: (page - 1) * pageSize,
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
          teknisi: true,
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
              role: true,
            },
          },
        },
      }),
      prisma.ticket.count({ where }),
      role !== 'MARKETING'
        ? prisma.ticket.groupBy({
            by: ['status'],
            _count: { status: true },
            where: baseWhere,
          })
        : Promise.resolve([]),
    ])

    let counts: TicketListCounts | null = null
    if (role !== 'MARKETING') {
      counts = { OPEN: 0, ON_PROGRESS: 0, CLOSE: 0, PENDING: 0 }
      const grouped = groupedCountsRaw as Array<{ status: string; _count: { status: number } }>
      for (const item of grouped) {
        const s = item.status
        if (s in counts) counts[s as keyof TicketListCounts] = item._count.status
      }
    }

    return { tickets, totalCount, counts }
  },
  ['tickets-list-data'],
  { revalidate: 15 }
)
