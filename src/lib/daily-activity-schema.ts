import { prisma } from '@/lib/prisma'

type GlobalState = {
  __dailyActivityInitPromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

/**
 * Bootstrap tabel Daily Activity (PostgreSQL) — mengikuti pola `ensureOdpTable`
 * agar skema dapat dibuat otomatis tanpa migrasi manual di server produksi.
 */
export async function ensureDailyActivityTables() {
  if (!g.__dailyActivityInitPromise) {
    g.__dailyActivityInitPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS psb_daily_activity_items (
            id SERIAL PRIMARY KEY,
            code VARCHAR(40) NOT NULL UNIQUE,
            "activityDate" TIMESTAMPTZ NOT NULL,
            "ownerUserId" INTEGER,
            "ownerName" VARCHAR(150) NOT NULL,
            division VARCHAR(100) NOT NULL,
            subdivision VARCHAR(100),
            "planningLevel" VARCHAR(20) NOT NULL DEFAULT 'STAFF',
            title TEXT NOT NULL,
            detail TEXT,
            location TEXT,
            target TEXT,
            "priorityLevel" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
            "executionStatus" VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
            "progressPercent" INTEGER NOT NULL DEFAULT 0,
            "planNote" TEXT,
            "resultNote" TEXT,
            "obstacleNote" TEXT,
            "closedAt" TIMESTAMPTZ,
            "approvalStatus" VARCHAR(20) NOT NULL DEFAULT 'NONE',
            "approvalNote" TEXT,
            "approvedByUserId" INTEGER,
            "approvedByName" VARCHAR(150),
            "approvedAt" TIMESTAMPTZ,
            "createdById" INTEGER,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `)

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS psb_daily_activity_profiles (
            id SERIAL PRIMARY KEY,
            "userId" INTEGER NOT NULL UNIQUE,
            "userName" VARCHAR(150) NOT NULL,
            division VARCHAR(100) NOT NULL,
            subdivision VARCHAR(100),
            "planningLevel" VARCHAR(20) NOT NULL DEFAULT 'STAFF',
            "approverUserId" INTEGER,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `)

        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS idx_psb_daily_activity_date ON psb_daily_activity_items ("activityDate" DESC);`
        )
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS idx_psb_daily_activity_owner ON psb_daily_activity_items ("ownerUserId");`
        )
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS idx_psb_daily_activity_division ON psb_daily_activity_items (division);`
        )
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS idx_psb_daily_activity_exec ON psb_daily_activity_items ("executionStatus");`
        )
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS idx_psb_daily_activity_approval ON psb_daily_activity_items ("approvalStatus");`
        )
      } catch (error) {
        g.__dailyActivityInitPromise = undefined
        throw error
      }
    })()
  }

  await g.__dailyActivityInitPromise
}
