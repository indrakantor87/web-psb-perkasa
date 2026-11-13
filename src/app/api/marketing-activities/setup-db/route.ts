
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MarketingActivity" (
          "id" SERIAL NOT NULL,
          "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "marketingName" TEXT NOT NULL,
          "activity" TEXT NOT NULL,
          "notes" TEXT,
          "flyer" INTEGER NOT NULL DEFAULT 0,
          "sosialisasi" INTEGER NOT NULL DEFAULT 0,
          "dataBase" INTEGER NOT NULL DEFAULT 0,
          "total" INTEGER NOT NULL DEFAULT 0,
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
    
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CoveredArea" (
          "id" SERIAL NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CoveredArea_pkey" PRIMARY KEY ("id")
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CoveredArea_name_key" ON "CoveredArea"("name");
    `)

    // Add areaId columns to MarketingActivity if they don't exist
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "areaId" INTEGER;
      `)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "areaId2" INTEGER;
      `)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "areaId3" INTEGER;
      `)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "areaId4" INTEGER;
      `)
      
      // Attempt to add foreign key (may fail if already exists)
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "MarketingActivity" 
          ADD CONSTRAINT "MarketingActivity_areaId_fkey" 
          FOREIGN KEY ("areaId") REFERENCES "CoveredArea"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        `)
      } catch (fkError) {
        console.log('Foreign key might already exist:', fkError)
      }

      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "MarketingActivity" 
          ADD CONSTRAINT "MarketingActivity_areaId2_fkey" 
          FOREIGN KEY ("areaId2") REFERENCES "CoveredArea"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        `)
      } catch (fkError) {
        console.log('Foreign key might already exist:', fkError)
      }

      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "MarketingActivity" 
          ADD CONSTRAINT "MarketingActivity_areaId3_fkey" 
          FOREIGN KEY ("areaId3") REFERENCES "CoveredArea"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        `)
      } catch (fkError) {
        console.log('Foreign key might already exist:', fkError)
      }

      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "MarketingActivity" 
          ADD CONSTRAINT "MarketingActivity_areaId4_fkey" 
          FOREIGN KEY ("areaId4") REFERENCES "CoveredArea"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        `)
      } catch (fkError) {
        console.log('Foreign key might already exist:', fkError)
      }
    } catch (colError) {
      console.log('Error adding areaId column:', colError)
    }

    // Add numeric activity columns to MarketingActivity if they don't exist
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "flyer" INTEGER NOT NULL DEFAULT 0;
      `)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "sosialisasi" INTEGER NOT NULL DEFAULT 0;
      `)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "dataBase" INTEGER NOT NULL DEFAULT 0;
      `)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MarketingActivity" ADD COLUMN IF NOT EXISTS "total" INTEGER NOT NULL DEFAULT 0;
      `)
    } catch (numColError) {
      console.log('Error adding numeric activity columns:', numColError)
    }

    return NextResponse.json({ message: 'Database setup completed successfully' })
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
