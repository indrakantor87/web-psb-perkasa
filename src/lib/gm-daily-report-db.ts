import { prisma } from '@/lib/prisma'

type GlobalState = {
  __ensureGmDailyReportTablePromise?: Promise<void>
}

const globalState = globalThis as unknown as GlobalState

async function ensureGmDailyReportTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "gm_daily_report_snapshots" (
      "id" SERIAL PRIMARY KEY,
      "reportDate" DATE NOT NULL UNIQUE,
      "totalPsbList" INTEGER NOT NULL,
      "installationQueue" INTEGER NOT NULL,
      "installedToday" INTEGER NOT NULL,
      "totalCustomers" INTEGER NOT NULL,
      "activeCustomers" INTEGER NOT NULL,
      "isolationContinued" INTEGER NOT NULL,
      "isolationNotContinued" INTEGER NOT NULL,
      "dismantleOpen" INTEGER NOT NULL,
      "dismantleClosed" INTEGER NOT NULL,
      "customerDeclinePercent" DOUBLE PRECISION NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'MANUAL',
      "createdByUserId" INTEGER,
      "createdByName" TEXT,
      "updatedByUserId" INTEGER,
      "updatedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "gm_daily_report_snapshots"
    ADD COLUMN IF NOT EXISTS "activeCustomers" INTEGER
  `)
  await prisma.$executeRawUnsafe(`
    UPDATE "gm_daily_report_snapshots"
    SET "activeCustomers" = GREATEST("totalCustomers" - "isolationContinued" - "isolationNotContinued", 0)
    WHERE "activeCustomers" IS NULL
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "gm_daily_report_snapshots"
    ALTER COLUMN "activeCustomers" SET NOT NULL
  `)
}

export async function ensureGmDailyReportTableOnce() {
  if (!globalState.__ensureGmDailyReportTablePromise) {
    globalState.__ensureGmDailyReportTablePromise = ensureGmDailyReportTable().catch((error) => {
      globalState.__ensureGmDailyReportTablePromise = undefined
      throw error
    })
  }

  await globalState.__ensureGmDailyReportTablePromise
}
