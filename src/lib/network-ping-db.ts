import { prisma } from '@/lib/prisma'

type GlobalState = {
  __ensureNetworkPingTablePromise?: Promise<void>
}

const globalState = globalThis as unknown as GlobalState

async function ensureNetworkPingTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "network_ping_results" (
      "id" SERIAL PRIMARY KEY,
      "pop_id" INTEGER NOT NULL,
      "pop_name" TEXT NOT NULL,
      "ip_address" TEXT NOT NULL,
      "success" BOOLEAN NOT NULL,
      "latency_ms" DOUBLE PRECISION,
      "error" TEXT,
      "checked_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "network_ping_results_checked_at_idx"
    ON "network_ping_results" ("checked_at" DESC)
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "network_ping_results_pop_id_idx"
    ON "network_ping_results" ("pop_id", "checked_at" DESC)
  `)
}

export async function ensureNetworkPingTableOnce() {
  if (!globalState.__ensureNetworkPingTablePromise) {
    globalState.__ensureNetworkPingTablePromise = ensureNetworkPingTable().catch((error) => {
      globalState.__ensureNetworkPingTablePromise = undefined
      throw error
    })
  }

  await globalState.__ensureNetworkPingTablePromise
}
