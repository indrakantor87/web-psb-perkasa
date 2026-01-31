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

  const where: any = {
    requestDate: {
      gte: startDate,
      lt: endDate,
    },
  }
  if (currentStatus === 'OPEN' || currentStatus === 'CLOSE' || currentStatus === 'PENDING') {
    (where as any).status = currentStatus
  }

  if (session.user.role === 'MARKETING') {
    where.marketingName = session.user.name
  } else if (currentMarketing && currentMarketing.trim()) {
    where.marketingName = {
      contains: currentMarketing.trim(),
    }
  }

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

  // Workaround for outdated Prisma Client: Fetch missing fields via raw query
  const ticketIds = tickets.map((t: any) => t.id)
  let ticketsWithExtras = tickets

  if (ticketIds.length > 0) {
    try {
      const rawData: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, fotoRumah, pengawalan, kmz, priority, birthDate FROM Ticket WHERE id IN (${ticketIds.join(',')})`
      )
      
      ticketsWithExtras = tickets.map((t: any) => {
        const extra = rawData.find((r: any) => String(r.id) === String(t.id))
        return {
          ...t,
          fotoRumah: extra?.fotoRumah || t.fotoRumah,
          pengawalan: extra?.pengawalan || t.pengawalan,
          kmz: extra?.kmz ?? (t as any).kmz,
          priority: extra?.priority || t.priority,
          birthDate: extra?.birthDate || t.birthDate
        }
      })
    } catch (e) {
      console.error('Failed to fetch extra fields in ListPage:', e)
      // Fallback if column 'kmz' or 'priority' or 'birthDate' does not exist yet
      try {
        const rawDataFallback: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, fotoRumah, pengawalan FROM Ticket WHERE id IN (${ticketIds.join(',')})`
        )
        ticketsWithExtras = tickets.map((t: any) => {
          const extra = rawDataFallback.find((r: any) => String(r.id) === String(t.id))
          return {
            ...t,
            fotoRumah: extra?.fotoRumah || t.fotoRumah,
            pengawalan: extra?.pengawalan || t.pengawalan,
            kmz: (t as any).kmz ?? null,
            priority: t.priority ?? null,
            birthDate: t.birthDate ?? null
          }
        })
      } catch (e2) {
        console.error('Fallback fetch also failed in ListPage:', e2)
      }
    }
  }

  // Transform dates to strings for serialization
  const serializedTickets = ticketsWithExtras.map((t: any) => ({
    ...t,
    requestDate: t.requestDate.toISOString(),
    installedDate: t.installedDate ? t.installedDate.toISOString() : null,
    birthDate: t.birthDate ? new Date(t.birthDate).toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">Daftar Tiket PSB</h1>
      <TicketList 
        tickets={serializedTickets} 
        userRole={session.user.role}
        initialPeriod={{ month: currentMonth, year: currentYear }}
        initialStatus={currentStatus}
        initialMarketing={currentMarketing}
      />
    </div>
  )
}
