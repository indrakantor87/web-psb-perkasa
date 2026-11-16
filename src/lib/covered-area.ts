import { prisma } from '@/lib/prisma'

/**
 * Resolves an area name to a CoveredArea id.
 * If no area with that name exists (case-insensitive), a new one is created.
 * Returns null when the provided name is empty.
 */
export async function resolveOrCreateAreaByName(
  name: unknown
): Promise<number | null> {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()

  const existing = await prisma.coveredArea.findFirst({
    where: { name: { equals: lower, mode: 'insensitive' } },
    select: { id: true },
  })

  if (existing) return existing.id

  const created = await prisma.coveredArea.create({
    data: { name: trimmed },
    select: { id: true },
  })

  return created.id
}
