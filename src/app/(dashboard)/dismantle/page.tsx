import { DismantleView } from '@/components/DismantleView'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

type DivisionFilter = 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'
type DismantleStatusFilter = 'OPEN' | 'CLOSED'

function toValidDivision(value?: string): DivisionFilter {
  if (value === 'PENJUALAN' || value === 'CS_ADMIN' || value === 'NOC_TROUBLESHOOTS' || value === 'CREATOR_DIGITAL') {
    return value
  }
  return 'ALL'
}

function toValidStatus(value?: string): DismantleStatusFilter {
  return value === 'CLOSED' ? 'CLOSED' : 'OPEN'
}

export default async function DismantlePage({
  searchParams,
}: {
  searchParams?: Promise<{ division?: string; status?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role === 'TEKNISI') redirect('/')

  const params = await searchParams
  const roleUpper = (session.user.role || '').toUpperCase()
  const division = roleUpper === 'DISMANTLE' ? 'CS_ADMIN' : toValidDivision(params?.division)
  const status = toValidStatus(params?.status)
  const pageTitle = roleUpper === 'DISMANTLE' ? `Ticket Dismantle ${status === 'OPEN' ? 'Open' : 'Close'}` : 'Dismantle Perangkat'
  const description =
    roleUpper === 'DISMANTLE'
      ? status === 'OPEN'
        ? 'Fokus ke data dismantle yang masih terbuka untuk ditindaklanjuti.'
        : 'Pantau riwayat data dismantle yang sudah ditutup.'
      : 'Pantau pelanggan isolir aktif dan kelola nomor ticket dismantle dari satu halaman.'

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{pageTitle}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <DismantleView
        userRole={session.user.role}
        initialDivision={division === 'ALL' ? 'CS_ADMIN' : division}
        initialStatus={status}
      />
    </div>
  )
}
