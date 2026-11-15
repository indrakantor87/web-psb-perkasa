import type { Prisma } from '@prisma/client'
import { isMarketingNameScopedRole, isSalesSupervisor } from '@/lib/access'
import { normalizeMarketingName } from '@/lib/marketing-users'

export function buildIsolationMarketingOwnerFilter(
  role: string | null | undefined,
  userName?: string | null,
): Prisma.IsolationWhereInput | null {
  if (!isMarketingNameScopedRole(role)) return null

  const ownerName = normalizeMarketingName(userName)
  if (!ownerName) return { id: { lt: 0 } }

  return {
    marketing: {
      equals: ownerName,
      mode: 'insensitive',
    },
  }
}

export function buildDismantleMarketingOwners(
  role: string | null | undefined,
  userName?: string | null,
  position?: string | null,
  subdivision?: string | null,
  division?: string | null,
): string[] | null {
  if (isSalesSupervisor(role, position, subdivision, division)) return null
  if (!isMarketingNameScopedRole(role)) return null

  const ownerName = normalizeMarketingName(userName)
  return ownerName ? [ownerName] : []
}
