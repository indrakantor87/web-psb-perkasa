import { InputForm } from '@/components/InputForm'
import { getSession } from '@/lib/auth'

export default async function InputPage() {
  const session = await getSession()

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">Input Data PSB</h1>
      <InputForm user={session?.user} />
    </div>
  )
}
