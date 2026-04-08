
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
    
    return NextResponse.json({ message: 'Table MarketingActivity created successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
