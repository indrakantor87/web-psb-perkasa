import { TicketList } from '@/components/TicketList'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDefaultTemplate } from '@/lib/data'
import { ensureDbOptimizations } from '@/lib/db-init'
import { getTicketsListData } from '@/lib/tickets-list-cache'
import { canAccessMenu, canMutateMenu } from '@/lib/access'

export const dynamic = 'force-dynamic'

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessMenu(session.user.role, 'list')) redirect('/')
  await ensureDbOptimizations()

  const resolvedSearchParams = await searchParams
  const monthParam = resolvedSearchParams.month
  const yearParam = resolvedSearchParams.year
  const statusParam = resolvedSearchParams.status
  const marketingParam = resolvedSearchParams.marketing
  const searchParam = resolvedSearchParams.search
  const limitParam = resolvedSearchParams.limit
  const divisionParam = resolvedSearchParams.division

  const now = new Date()
  const currentMonth = typeof monthParam === 'string' ? parseInt(monthParam) : now.getMonth() + 1
  const currentYear = typeof yearParam === 'string' ? parseInt(yearParam) : now.getFullYear()
  const currentStatus = typeof statusParam === 'string' ? statusParam.toUpperCase() : 'ALL'
  const currentMarketing = typeof marketingParam === 'string' ? marketingParam : ''
  const currentSearch = typeof searchParam === 'string' ? searchParam : ''
  const currentDivision =
    typeof divisionParam === 'string' &&
    ['ALL', 'PENJUALAN', 'CS_ADMIN', 'NOC_TROUBLESHOOTS', 'CREATOR_DIGITAL'].includes(divisionParam.toUpperCase())
      ? divisionParam.toUpperCase()
      : 'ALL'

  const pageParam = resolvedSearchParams.page
  const currentPageNumber = typeof pageParam === 'string' ? parseInt(pageParam) : 1
  const pageSize = typeof limitParam === 'string' ? parseInt(limitParam) : 25

  let tickets: Awaited<ReturnType<typeof getTicketsListData>>['tickets'] = []
  let totalCount = 0
  let countsForUi: Awaited<ReturnType<typeof getTicketsListData>>['counts'] | undefined = undefined
  let defaultTemplate: Awaited<ReturnType<typeof getDefaultTemplate>> = null
  try {
    defaultTemplate = await getDefaultTemplate()
  } catch {
    defaultTemplate = null
  }
  try {
    const list = await getTicketsListData({
      role: session.user.role,
      userName: session.user.name,
      division: currentDivision,
      month: currentMonth,
      year: currentYear,
      status: currentStatus,
      marketing: currentMarketing,
      search: currentSearch,
      page: currentPageNumber,
      pageSize,
    })
    tickets = list.tickets
    totalCount = list.totalCount
    countsForUi = list.counts ?? undefined
  } catch {
    tickets = []
    totalCount = 0
    countsForUi = undefined
  }

  // No need for separate photo query anymore
  const formattedTickets = tickets.map(t => ({
    ...t,
    requestDate: t.requestDate.toISOString(),
    installedDate: t.installedDate ? t.installedDate.toISOString() : null,
    birthDate: t.birthDate ? t.birthDate.toISOString() : null,
    hasPhoto: t.hasPhoto, // Use optimized field directly
    fotoRumah: null // Ensure we don't pass base64 string even if it was somehow fetched
  }))

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">PSB Ticket List</h1>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 sm:p-6 lg:p-8">
          <TicketList 
            tickets={formattedTickets} 
            userRole={session.user.role}
            readOnly={!canMutateMenu(session.user.role, 'list')}
            initialPeriod={{ month: currentMonth, year: currentYear }}
            initialStatus={currentStatus}
            initialMarketing={currentMarketing}
            initialSearch={currentSearch}
            initialDivision={currentDivision}
            pagination={{
              currentPage: currentPageNumber,
              totalPages: Math.ceil(totalCount / pageSize),
              totalCount: totalCount,
              pageSize
            }}
            counts={countsForUi}
            defaultTemplateContent={defaultTemplate?.content || ''}
          />
        </div>
      </div>
    </div>
  )
}
