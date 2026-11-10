import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Updating Ticket table schema...')
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Ticket" 
      ADD COLUMN IF NOT EXISTS "odpId" INT,
      ADD COLUMN IF NOT EXISTS "portNumber" INT;
    `)
    console.log('Success adding odpId and portNumber to Ticket table.')
  } catch (e) {
    console.error('Failed to update Ticket table:', e)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
