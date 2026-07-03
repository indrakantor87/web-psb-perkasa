import { DismantleView } from '@/components/DismantleView'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

type DivisionFilter = 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'

function toValidDivision(value?: string): DivisionFilter {
  if (value === 'PENJUALAN' || value === 'CS_ADMIN' || value === 'NOC_TROUBLESHOOTS' || value === 'CREATOR_DIGITAL') {
    return value
  }
  return 'ALL'
}

export default async function DismantlePage({
  searchParams,
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role === 'TEKNISI') redirect('/')

  const params = await searchParams
  const division = toValidDivision(params?.division)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Dismantle Perangkat</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pantau pelanggan isolir aktif dan kelola nomor ticket dismantle dari satu halaman.
        </p>
      </div>
      <DismantleView userRole={session.user.role} initialDivision={division === 'ALL' ? 'CS_ADMIN' : division} />
    </div>
  )
}
