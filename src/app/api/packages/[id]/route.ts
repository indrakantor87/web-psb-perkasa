import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { getSession } from '@/lib/auth'

type PackageDelegate = {
  delete: (args: { where: { id: number } }) => Promise<unknown>
}

const prismaPkg = prisma as unknown as typeof prisma & { package: PackageDelegate }

let ensuredPromise: Promise<void> | null = null

async function ensurePackageTableOnce() {
  if (!ensuredPromise) {
    ensuredPromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Package" (
        "id" SERIAL NOT NULL,
        "name" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
      );
    `)
      .then(async () => {
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Package_name_key" ON "Package"("name");`)
      })
      .catch((e) => {
        ensuredPromise = null
        throw e
      })
  }
  await ensuredPromise
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    await prismaPkg.package.delete({
      where: { id },
    })
    cache.invalidateByPrefix('packages:')
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error deleting package' }, { status: 500 })
  }
}
