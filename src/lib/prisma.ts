import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function ensureSslMode(url: string) {
  try {
    const u = new URL(url)
    if (!u.searchParams.has('sslmode')) {
      u.searchParams.set('sslmode', 'require')
    }
    return u.toString()
  } catch {
    return url
  }
}

if (process.env.NODE_ENV !== 'production') {
  const databaseUrl = process.env.DATABASE_URL
  const directUrl = process.env.DIRECT_URL

  if (directUrl && databaseUrl && databaseUrl.includes('pooler.supabase.com')) {
    process.env.DATABASE_URL = directUrl
  }

  if (process.env.DATABASE_URL) process.env.DATABASE_URL = ensureSslMode(process.env.DATABASE_URL)
  if (process.env.DIRECT_URL) process.env.DIRECT_URL = ensureSslMode(process.env.DIRECT_URL)
}

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
