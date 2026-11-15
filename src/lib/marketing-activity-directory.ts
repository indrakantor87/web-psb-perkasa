import { prisma } from '@/lib/prisma'
import { marketingNameKey, normalizeMarketingName, type MarketingUserOption } from '@/lib/marketing-users'

const EXCLUDED_NAME_KEYS = new Set([
  'manager',
  'manager pemasaran',
  'manager pemasaran dan pelayanan',
  'spv',
  'spv marketing',
  'spv penjualan',
  'supervisor',
  'kantor',
  'digital creator',
  'creator digital',
].map(marketingNameKey))

type MarketingActivityUserIdentity = {
  name?: string | null
  role?: string | null
  position?: string | null
  division?: string | null
  subdivision?: string | null
}

export function isExcludedMarketingActivityIdentity(user: MarketingActivityUserIdentity) {
  const nameKey = marketingNameKey(user.name)
  const role = String(user.role ?? '').trim().toUpperCase()
  const position = marketingNameKey(user.position)
  const division = marketingNameKey(user.division)
  const subdivision = marketingNameKey(user.subdivision)

  return (
    EXCLUDED_NAME_KEYS.has(nameKey) ||
    /^(manager|spv|supervisor|kantor|digital creator|creator digital)(\s|$)/.test(nameKey) ||
    role === 'CREATOR_DIGITAL' ||
    role === 'DIGITAL_CREATOR' ||
    position.includes('manager') ||
    position.includes('spv') ||
    position.includes('supervisor') ||
    position.includes('kantor') ||
    position.includes('digital creator') ||
    position.includes('creator digital') ||
    division.includes('kantor') ||
    division.includes('digital creator') ||
    division.includes('creator digital') ||
    subdivision.includes('kantor') ||
    subdivision.includes('digital creator') ||
    subdivision.includes('creator digital')
  )
}

export type MarketingActivityDirectory = {
  marketingUsers: MarketingUserOption[]
  excludedNameKeys: string[]
}

export async function getMarketingActivityDirectory(): Promise<MarketingActivityDirectory> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      position: true,
      division: true,
      subdivision: true,
    },
    orderBy: { name: 'asc' },
  })

  const excludedNameKeys = new Set(EXCLUDED_NAME_KEYS)
  for (const user of users) {
    if (isExcludedMarketingActivityIdentity(user)) {
      const key = marketingNameKey(user.name)
      if (key) excludedNameKeys.add(key)
    }
  }

  const marketingUsersByKey = new Map<string, MarketingUserOption>()
  for (const user of users) {
    const name = normalizeMarketingName(user.name)
    const key = marketingNameKey(name)
    if (
      !name ||
      String(user.role ?? '').trim().toUpperCase() !== 'MARKETING' ||
      excludedNameKeys.has(key) ||
      marketingUsersByKey.has(key)
    ) {
      continue
    }

    marketingUsersByKey.set(key, { id: user.id, name, username: user.username })
  }

  return {
    marketingUsers: Array.from(marketingUsersByKey.values()),
    excludedNameKeys: Array.from(excludedNameKeys),
  }
}

export function resolveMarketingActivityName(
  value: unknown,
  directory: MarketingActivityDirectory
) {
  const key = marketingNameKey(value)
  if (!key || directory.excludedNameKeys.includes(key)) return null
  return directory.marketingUsers.find((user) => marketingNameKey(user.name) === key)?.name ?? null
}
