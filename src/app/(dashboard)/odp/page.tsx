import { OdpManager } from '@/components/OdpManager'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function OdpPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const canEdit = ['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(session.user.role)

  return <OdpManager canEdit={canEdit} />
}
