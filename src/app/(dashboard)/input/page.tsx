import { InputForm } from '@/components/InputForm'
import { getSession } from '@/lib/auth'
import { canAccessMenu, canMutateMenu } from '@/lib/access'
import { redirect } from 'next/navigation'

export default async function InputPage({
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessMenu(session.user.role, 'input')) redirect('/')

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Input Data PSB</h1>
      <InputForm user={session?.user} readOnly={!canMutateMenu(session.user.role, 'input')} />
    </div>
  )
}
