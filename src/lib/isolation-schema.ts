import { prisma } from '@/lib/prisma'

type GlobalState = {
  __ensureIsolationColumnsPromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

async function ensureIsolationColumns() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "ticketDismantle" TEXT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "price" DECIMAL(15,2)').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "closeNote" TEXT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "closePhoto" TEXT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "sortIndex" INT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT FALSE').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)').catch(() => {})
  await prisma.$executeRawUnsafe('UPDATE "Isolation" SET "isArchived" = FALSE WHERE "isArchived" IS NULL').catch(() => {})

  await prisma.$executeRawUnsafe(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(NULLIF(TRIM("radboox"), ''), 'UNASSIGNED')
          ORDER BY
            "activeDate" DESC NULLS LAST,
            "isolationDate" DESC NULLS LAST,
            id DESC
        ) AS rn
      FROM "Isolation"
      WHERE "sortIndex" IS NULL
    )
    UPDATE "Isolation" i
    SET "sortIndex" = ranked.rn * 10
    FROM ranked
    WHERE ranked.id = i.id;
  `).catch(() => {})
}

export async function ensureIsolationColumnsOnce() {
  if (!g.__ensureIsolationColumnsPromise) {
    g.__ensureIsolationColumnsPromise = ensureIsolationColumns().catch((error) => {
      g.__ensureIsolationColumnsPromise = undefined
      throw error
    })
  }

  await g.__ensureIsolationColumnsPromise
}
