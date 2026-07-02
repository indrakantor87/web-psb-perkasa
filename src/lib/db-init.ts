import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

type GlobalState = {
  __dbInitPromise?: Promise<void>
  __userDivisionInitPromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

export async function ensureDbOptimizations() {
  if (!g.__dbInitPromise) {
    g.__dbInitPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
      } catch {}

      const statements: string[] = [
        `CREATE INDEX IF NOT EXISTS "Ticket_statusOrder_idx" ON "Ticket" ("statusOrder");`,
        `CREATE INDEX IF NOT EXISTS "Ticket_statusOrder_requestDate_idx" ON "Ticket" ("statusOrder", "requestDate");`,
        `CREATE INDEX IF NOT EXISTS "Isolation_status_isolationDate_idx" ON "Isolation" ("status", "isolationDate");`,
      ]

      for (const sql of statements) {
        try {
          await prisma.$executeRawUnsafe(sql)
        } catch {}
      }

      const trigramStatements: string[] = [
        `CREATE INDEX IF NOT EXISTS idx_psb_odp_nama_odp_trgm ON psb_odp USING gin (nama_odp gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS idx_psb_odp_lokasi_trgm ON psb_odp USING gin (lokasi gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS "Ticket_customerName_trgm_idx" ON "Ticket" USING gin ("customerName" gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS "Ticket_pengawalan_trgm_idx" ON "Ticket" USING gin ("pengawalan" gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS "Isolation_customerName_trgm_idx" ON "Isolation" USING gin ("customerName" gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS "Isolation_marketing_trgm_idx" ON "Isolation" USING gin ("marketing" gin_trgm_ops);`,
      ]
      for (const sql of trigramStatements) {
        try {
          await prisma.$executeRawUnsafe(sql)
        } catch {}
      }

      try {
        await prisma.ticket.updateMany({
          where: { status: 'PENDING' },
          data: { status: 'ON_PROGRESS', statusOrder: 1 },
        })
      } catch {}

      if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEV_ADMIN === '1') {
        try {
          const userCount = await prisma.user.count()
          if (userCount === 0) {
            const hashed = await bcrypt.hash('123456', 10)
            await prisma.user.create({
              data: {
                name: 'Admin',
                username: 'admin',
                password: hashed,
                role: 'ADMIN',
              },
            })
          }
        } catch {}
      }
    })()
  }
  await g.__dbInitPromise
}

export async function ensureUserDivisionColumn() {
  if (!g.__userDivisionInitPromise) {
    g.__userDivisionInitPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "division" TEXT;`)
      } catch (e) {
        g.__userDivisionInitPromise = undefined
        throw e
      }
    })()
  }
  await g.__userDivisionInitPromise
}
