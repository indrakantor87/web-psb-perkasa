import { OdpManager } from '@/components/OdpManager'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

function toValidDivision(value?: string) {
  if (value === 'PENJUALAN' || value === 'CS_ADMIN' || value === 'NOC_TROUBLESHOOTS' || value === 'CREATOR_DIGITAL') {
    return value
  }
  return 'ALL'
}

export default async function OdpPage({
  searchParams,
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  const params = await searchParams

  const canEdit = ['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(session.user.role)

  return <OdpManager canEdit={canEdit} userRole={session.user.role} initialDivision={toValidDivision(params?.division)} />
}
