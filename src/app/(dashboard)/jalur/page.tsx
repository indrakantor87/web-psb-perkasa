import JalurMap from '@/components/JalurMap'
import { getSession } from '@/lib/auth'
import { canAccessMenu, canMutateMenu } from '@/lib/access'
import { redirect } from 'next/navigation'

export default async function JalurPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessMenu(session.user.role, 'jalur')) redirect('/')

  const canEdit = canMutateMenu(session.user.role, 'jalur')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Jalur Jaringan</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Peta jalur kabel fiber, titik splice, POP, ODC, dan ODP.
        </p>
      </div>
      <JalurMap canEdit={canEdit} />
    </div>
  )
}
