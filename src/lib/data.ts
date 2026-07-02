import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

function isPrismaConnectionError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error)
  return (
    message.includes('PrismaClientInitializationError') ||
    message.includes('Error querying the database') ||
    message.includes('ENOTFOUND') ||
    message.includes('Can\'t reach database server')
  )
}

export const getPriorities = unstable_cache(
  async () => {
    try {
      return await prisma.priority.findMany()
    } catch (error) {
      if (process.env.NODE_ENV !== 'production' && isPrismaConnectionError(error)) {
        return []
      }
      throw error
    }
  },
  ['priorities-list'],
  {
    revalidate: 3600, // Cache for 1 hour
    tags: ['priorities']
  }
)

export const getDefaultTemplate = unstable_cache(
  async () => {
    try {
      return await prisma.whatsappTemplate.findFirst({
        where: { isDefault: true }
      })
    } catch (error) {
      if (process.env.NODE_ENV !== 'production' && isPrismaConnectionError(error)) {
        return null
      }
      throw error
    }
  },
  ['default-whatsapp-template'],
  {
    revalidate: 3600, // Cache for 1 hour
    tags: ['templates']
  }
)
