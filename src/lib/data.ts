import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

export const getPriorities = unstable_cache(
  async () => {
    return await prisma.priority.findMany()
  },
  ['priorities-list'],
  {
    revalidate: 3600, // Cache for 1 hour
    tags: ['priorities']
  }
)

export const getDefaultTemplate = unstable_cache(
  async () => {
    return await prisma.whatsappTemplate.findFirst({
      where: { isDefault: true }
    })
  },
  ['default-whatsapp-template'],
  {
    revalidate: 3600, // Cache for 1 hour
    tags: ['templates']
  }
)
