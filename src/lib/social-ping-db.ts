import { prisma } from '@/lib/prisma'

type GlobalState = {
  __ensureSocialPingTablePromise?: Promise<void>
}

const globalState = globalThis as unknown as GlobalState

async function ensureSocialPingTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "social_ping_results" (
      "id" SERIAL PRIMARY KEY,
      "platform" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "endpoint_url" TEXT NOT NULL,
      "success" BOOLEAN NOT NULL,
      "status_code" INTEGER,
      "latency_ms" DOUBLE PRECISION,
      "error" TEXT,
      "checked_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "social_ping_results_checked_at_idx"
    ON "social_ping_results" ("checked_at" DESC)
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "social_ping_results_platform_idx"
    ON "social_ping_results" ("platform", "checked_at" DESC)
  `)
}

export async function ensureSocialPingTableOnce() {
  if (!globalState.__ensureSocialPingTablePromise) {
    globalState.__ensureSocialPingTablePromise = ensureSocialPingTable().catch((error) => {
      globalState.__ensureSocialPingTablePromise = undefined
      throw error
    })
  }

  await globalState.__ensureSocialPingTablePromise
}
