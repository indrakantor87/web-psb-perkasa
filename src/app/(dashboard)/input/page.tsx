import { InputForm } from '@/components/InputForm'
import { getSession } from '@/lib/auth'

export default async function InputPage({
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Input Data PSB</h1>
      <InputForm user={session?.user} />
    </div>
  )
}
