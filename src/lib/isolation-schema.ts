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
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT FALSE').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "importBatchAt" TIMESTAMP(3)').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "importRowOrder" INTEGER').catch(() => {})
  await prisma.$executeRawUnsafe('UPDATE "Isolation" SET "isArchived" = FALSE WHERE "isArchived" IS NULL').catch(() => {})
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
