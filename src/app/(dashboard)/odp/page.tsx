import { OdpManager } from '@/components/OdpManager'
import { getSession } from '@/lib/auth'
import { canAccessMenu, canMutateMenu } from '@/lib/access'
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
  if (!canAccessMenu(session.user.role, 'odp')) redirect('/')
  const params = await searchParams

  const canEdit = canMutateMenu(session.user.role, 'odp')

  return <OdpManager canEdit={canEdit} userRole={session.user.role} initialDivision={toValidDivision(params?.division)} />
}
