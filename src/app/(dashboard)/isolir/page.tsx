import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { IsolationView } from '@/components/IsolationView'

export const dynamic = 'force-dynamic'

export default async function IsolirPage({ searchParams }: { searchParams?: { search?: string, marketing?: string, status?: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role === 'TEKNISI') redirect('/')

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
        initialSearch={searchParams?.search || ''} 
        initialMarketing={searchParams?.marketing || ''} 
        initialStatus={searchParams?.status || ''} 
      />
    </div>
  )
}
