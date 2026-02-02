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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Tiket PSB</h1>
      </div>

      <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
        <div className="p-4 sm:p-6 lg:p-8">
          <TicketList 
            tickets={tickets as any} 
            userRole={session.user.role}
            initialPeriod={{ month: currentMonth, year: currentYear }}
            initialStatus={currentStatus}
            initialMarketing={currentMarketing}
          />
        </div>
      </div>
    </div>
  )
}
