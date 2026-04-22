import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { getSession } from '@/lib/auth'

type PackageRow = {
  id: number
  name: string
  createdAt: Date
  updatedAt: Date
}

type PackageDelegate = {
  findMany: (args: { orderBy: { name: 'asc' | 'desc' } }) => Promise<PackageRow[]>
  create: (args: { data: { name: string } }) => Promise<PackageRow>
}

const prismaPkg = prisma as unknown as typeof prisma & { package: PackageDelegate }

let ensuredPromise: Promise<void> | null = null

const DEFAULT_PACKAGES = ['HOME LITE', 'HOME BASIC', 'HOME STREAM', 'HOME ENTERTAIN', 'HOME SMALL', 'HOME ADVAN']

async function ensurePackageTableOnce() {
  if (!ensuredPromise) {
    ensuredPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Package" (
          "id" SERIAL NOT NULL,
          "name" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
        );
      `)
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Package_name_key" ON "Package"("name");`)

      const values = DEFAULT_PACKAGES.map((p) => `('${p.replace(/'/g, "''")}')`).join(',')
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Package" ("name")
        VALUES ${values}
        ON CONFLICT ("name") DO NOTHING;
      `)
    })().catch((e) => {
      ensuredPromise = null
      throw e
    })
  }
  await ensuredPromise
}

export async function GET() {
  try {
    await ensurePackageTableOnce().catch(() => {})
    const packages = await prismaPkg.package.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(packages)
  } catch {
    return NextResponse.json({ error: 'Error fetching packages' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await ensurePackageTableOnce().catch(() => {})
    const json = (await request.json().catch(() => ({}))) as { name?: string }
    const name = json.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const pkg = await prismaPkg.package.create({
      data: { name },
    })
    cache.invalidateByPrefix('packages:')
    return NextResponse.json(pkg)
  } catch {
    return NextResponse.json({ error: 'Error creating package' }, { status: 500 })
  }
}
