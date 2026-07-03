import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { IsolationView } from '@/components/IsolationView'

export const dynamic = 'force-dynamic'

export default async function IsolirPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; marketing?: string; status?: string; division?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role === 'TEKNISI') redirect('/')
  const params = await searchParams

  const initialDivision =
    params?.division === 'ALL' ||
    params?.division === 'PENJUALAN' ||
    params?.division === 'CS_ADMIN' ||
    params?.division === 'NOC_TROUBLESHOOTS' ||
    params?.division === 'CREATOR_DIGITAL'
      ? params.division
      : 'ALL'

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Monitoring Isolir Pelanggan</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Daftar pelanggan yang status layanannya sedang diisolir.
        </p>
      </div>
      
      <IsolationView 
        userRole={session.user.role} 
        initialSearch={params?.search || ''} 
        initialMarketing={session.user.role === 'ADMIN' ? '' : params?.marketing || ''} 
        initialStatus={params?.status || ''} 
        initialDivision={initialDivision}
      />
    </div>
  )
}
