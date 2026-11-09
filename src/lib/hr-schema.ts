import { prisma } from '@/lib/prisma'

type GlobalState = {
  __ensureHrSchemaPromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

async function ensureHrSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Employee" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "department" TEXT NOT NULL DEFAULT 'Pemasaran dan Pelayanan',
      "position" TEXT NOT NULL DEFAULT 'STAFF',
      "employmentStatus" TEXT NOT NULL DEFAULT 'Karyawan',
      "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "fingerprintId" TEXT,
      "userId" INTEGER,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "userId" INTEGER;`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee" ("userId");`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Employee_fingerprintId_key" ON "Employee" ("fingerprintId");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Employee_name_idx" ON "Employee" ("name");`)
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Employee_userId_fkey') THEN
        ALTER TABLE "Employee"
          ADD CONSTRAINT "Employee_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `).catch(() => {})

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Attendance" (
      "id" SERIAL PRIMARY KEY,
      "employeeId" INTEGER NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "checkIn" TIMESTAMP(3),
      "checkOut" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'PRESENT',
      "source" TEXT NOT NULL DEFAULT 'FINGERPRINT_MACHINE',
      "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_employeeId_date_key" ON "Attendance" ("employeeId", "date");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attendance_date_idx" ON "Attendance" ("date");`)
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Attendance_employeeId_fkey'
      ) THEN
        ALTER TABLE "Attendance"
          ADD CONSTRAINT "Attendance_employeeId_fkey"
          FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `).catch(() => {})

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HrMachineSetting" (
      "id" SERIAL PRIMARY KEY,
      "machineIp" TEXT NOT NULL DEFAULT '',
      "machinePort" INTEGER NOT NULL DEFAULT 4370,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

export async function ensureHrSchemaOnce() {
  if (!g.__ensureHrSchemaPromise) {
    g.__ensureHrSchemaPromise = ensureHrSchema().catch((error) => {
      g.__ensureHrSchemaPromise = undefined
      throw error
    })
  }

  await g.__ensureHrSchemaPromise
}
