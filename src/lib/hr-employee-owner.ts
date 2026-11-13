import { prisma } from '@/lib/prisma'

/**
 * Memetakan user yang login ke satu karyawan.
 * Prioritas: relasi langsung `Employee.userId` (paling akurat), lalu fallback ke nama unik.
 * `null` berarti tidak ada karyawan yang cocok, sehingga tidak ada record yang ditampilkan (fail-closed).
 */
export async function resolveUniqueEmployeeIdByName(name: string, userId?: number) {
  if (Number.isInteger(userId) && userId! > 0) {
    const byUser = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (byUser) return byUser.id
  }

  const normalizedName = name.trim()
  if (!normalizedName) return null

  const matchingEmployees = await prisma.employee.findMany({
    where: { name: { equals: normalizedName, mode: 'insensitive' } },
    select: { id: true },
    take: 2,
  })
  return matchingEmployees.length === 1 ? matchingEmployees[0].id : null
}

export async function resolveUniqueMarketingEmployeeId(userId: number, name: string) {
  if (Number.isInteger(userId) && userId > 0) {
    const byUser = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (byUser) return byUser.id
  }

  const normalizedName = name.trim()
  if (!normalizedName) return null

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
