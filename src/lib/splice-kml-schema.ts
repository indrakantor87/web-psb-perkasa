import { prisma } from '@/lib/prisma'

type GlobalState = {
  __spliceKmlIconStylePromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

export async function ensureSpliceKmlIconStyleColumn() {
  if (!g.__spliceKmlIconStylePromise) {
    g.__spliceKmlIconStylePromise = prisma.$executeRawUnsafe(
      'ALTER TABLE psb_splice ADD COLUMN IF NOT EXISTS kml_icon_style JSONB;',
    )
      .then(() => undefined)
      .catch((error) => {
        g.__spliceKmlIconStylePromise = undefined
        throw error
      })
  }
  await g.__spliceKmlIconStylePromise
}
