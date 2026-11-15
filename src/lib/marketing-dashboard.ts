import { marketingNameKey } from '@/lib/marketing-users'

export type MarketingAnnualCustomerRow = {
  name: string
  total: number
  byMonth: number[]
}

export function rankActiveMarketingCustomers<T extends MarketingAnnualCustomerRow>(
  rows: T[],
  activeMarketingNames: string[],
  limit = 15
): T[] {
  const activeMarketingKeys = new Set(activeMarketingNames.map(marketingNameKey))
  const safeLimit = Math.max(0, Math.floor(limit))

  return rows
    .filter((row) => activeMarketingKeys.has(marketingNameKey(row.name)))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, safeLimit)
}
