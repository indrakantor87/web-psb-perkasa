import { prisma } from '@/lib/prisma'

export async function resolveUniqueMarketingEmployeeId(userId: number, name: string) {
  const normalizedName = name.trim()
  if (!normalizedName || !Number.isInteger(userId) || userId <= 0) return null

  const matchingUsers = await prisma.user.findMany({
    where: {
      role: 'MARKETING',
      name: { equals: normalizedName, mode: 'insensitive' },
    },
    select: { id: true },
    take: 2,
  })
  if (matchingUsers.length !== 1 || matchingUsers[0].id !== userId) return null

  const matchingEmployees = await prisma.employee.findMany({
    where: { name: { equals: normalizedName, mode: 'insensitive' } },
    select: { id: true },
    take: 2,
  })
  return matchingEmployees.length === 1 ? matchingEmployees[0].id : null
}
