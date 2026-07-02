import { prisma } from '@/lib/prisma'

export type MarketingUserOption = {
  id: number
  name: string
  username: string
}

export const INVALID_MARKETING_LABEL = 'Marketing Tidak Valid'
export const EMPTY_MARKETING_LABEL = 'Belum Diisi'

export function normalizeMarketingName(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function marketingNameKey(value: unknown) {
  return normalizeMarketingName(value).toLowerCase()
}

export function isSyntheticMarketingLabel(value: unknown) {
  const normalized = marketingNameKey(value)
  return normalized === marketingNameKey(INVALID_MARKETING_LABEL) || normalized === marketingNameKey(EMPTY_MARKETING_LABEL)
}

export function toDisplayMarketingName(value: unknown) {
  const normalized = normalizeMarketingName(value)
  if (!normalized || isSyntheticMarketingLabel(normalized)) return ''
  return normalized
}

export async function getMarketingUsers(): Promise<MarketingUserOption[]> {
  const users = await prisma.user.findMany({
    where: { role: 'MARKETING' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, username: true },
  })

  const deduped = new Map<string, MarketingUserOption>()
  for (const user of users) {
    const normalizedName = normalizeMarketingName(user.name)
    if (!normalizedName) continue
    const key = marketingNameKey(normalizedName)
    if (!deduped.has(key)) {
      deduped.set(key, {
        id: user.id,
        name: normalizedName,
        username: user.username,
      })
    }
  }

  return Array.from(deduped.values())
}

export async function getMarketingNameMap() {
  const users = await getMarketingUsers()
  return new Map(users.map((user) => [marketingNameKey(user.name), user.name]))
}

export async function resolveMarketingName(value: unknown) {
  const normalized = normalizeMarketingName(value)
  if (!normalized) return null

  const nameMap = await getMarketingNameMap()
  return nameMap.get(marketingNameKey(normalized)) ?? null
}

export function toCanonicalMarketingLabel(value: unknown, nameMap: Map<string, string>) {
  const normalized = normalizeMarketingName(value)
  if (!normalized) return EMPTY_MARKETING_LABEL
  return nameMap.get(marketingNameKey(normalized)) ?? INVALID_MARKETING_LABEL
}
