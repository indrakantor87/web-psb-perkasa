import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { IsolationView } from '@/components/IsolationView'

export const dynamic = 'force-dynamic'

export default async function IsolirPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monitoring Isolir Pelanggan</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Daftar pelanggan yang status layanannya sedang diisolir.
        </p>
      </div>
      
      <IsolationView userRole={session.user.role} />
    </div>
  )
}
