
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    console.log('Attempting to create MarketingActivity table...')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MarketingActivity" (
          "id" SERIAL NOT NULL,
          "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "marketingName" TEXT NOT NULL,
          "activity" TEXT NOT NULL,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "MarketingActivity_pkey" PRIMARY KEY ("id")
      );
    `)
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "MarketingActivity_date_idx" ON "MarketingActivity"("date");
    `)
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "MarketingActivity_marketingName_idx" ON "MarketingActivity"("marketingName");
    `)
    
    console.log('Success: MarketingActivity table and indexes created (or already existed).')
  } catch (error) {
    console.error('Error creating table:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
