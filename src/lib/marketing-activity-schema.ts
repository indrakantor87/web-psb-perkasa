import { prisma } from '@/lib/prisma'

type GlobalState = {
  __ensureMarketingActivityColumns?: Promise<void>
}

const globalState = globalThis as unknown as GlobalState

async function ensureMarketingActivityColumns() {
  const statements = [
    `ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "flyer" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "sosialisasi" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "dataBase" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "event" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "total" INTEGER NOT NULL DEFAULT 0;`,
  ]

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql)
  }

  await prisma.$executeRawUnsafe(`
    UPDATE "MarketingActivity"
    SET "total" = "flyer" + "sosialisasi" + "event"
    WHERE "total" = 0 AND ("flyer" <> 0 OR "sosialisasi" <> 0 OR "event" <> 0);
  `)
}

/**
 * Memastikan kolom angka pada MarketingActivity (flyer, sosialisasi, dataBase, event, total)
 * sudah tersedia di database. Idempoten dan dijalankan sekali per proses.
 */
export async function ensureMarketingActivityColumnsOnce() {
  if (!globalState.__ensureMarketingActivityColumns) {
    globalState.__ensureMarketingActivityColumns = ensureMarketingActivityColumns().catch((error) => {
      globalState.__ensureMarketingActivityColumns = undefined
      throw error
    })
  }

  await globalState.__ensureMarketingActivityColumns
}
