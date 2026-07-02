import { InputForm } from '@/components/InputForm'
import { getSession } from '@/lib/auth'

function toValidDivision(value?: string) {
  if (value === 'PENJUALAN' || value === 'CS_ADMIN' || value === 'NOC_TROUBLESHOOTS' || value === 'CREATOR_DIGITAL') {
    return value
  }
  return 'ALL'
}

export default async function InputPage({
  searchParams,
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()
  const params = await searchParams
  const initialDivision = toValidDivision(params?.division)

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Input Data PSB</h1>
      <InputForm user={session?.user} initialDivision={initialDivision} />
    </div>
  )
}
