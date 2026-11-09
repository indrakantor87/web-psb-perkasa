import type { Prisma } from '@prisma/client'
import { isMarketingNameScopedRole } from '@/lib/access'
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
): string[] | null {
  if (!isMarketingNameScopedRole(role)) return null

  const ownerName = normalizeMarketingName(userName)
  return ownerName ? [ownerName] : []
}
