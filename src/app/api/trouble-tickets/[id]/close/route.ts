import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

async function ensureTroubleTicketTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicket" (
      "id" SERIAL NOT NULL,
      "ticketCode" TEXT,
      "ticketPrefix" TEXT,
      "ticketNumber" INT,
      "periodMonth" INT,
      "periodYear" INT,
      "customerName" TEXT NOT NULL,
      "user" TEXT,
      "waNumber" TEXT NOT NULL,
      "mapsUrl" TEXT,
      "type" TEXT NOT NULL,
      "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "closedAt" TIMESTAMP(3),
      "notes" TEXT,
      "closeNotes" TEXT,
      "closePhotos" TEXT[],
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TroubleTicket_pkey" PRIMARY KEY ("id")
    );
  `)

  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "user" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "ticketCode" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "ticketPrefix" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "ticketNumber" INT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "periodMonth" INT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "periodYear" INT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closeNotes" TEXT;`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closePhotos" TEXT[];`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "closeBy" TEXT;`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicket_ticketCode_key" ON "TroubleTicket"("ticketCode");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_status_idx" ON "TroubleTicket"("status");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicket_openedAt_idx" ON "TroubleTicket"("openedAt");`)
}

function toInt(v: string) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

function normalizePhotos(files: File[]) {
  const limited = files.slice(0, 10)
  const validTypes = new Set(['image/jpeg', 'image/png', 'image/jpg', 'image/webp'])
  for (const f of limited) {
    if (!validTypes.has(f.type)) throw new Error(`Format file tidak didukung: ${f.type}`)
    if (f.size > 10 * 1024 * 1024) throw new Error('Ukuran file maksimal 10MB')
  }
  return limited
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC', 'TEKNISI', 'TROUBLESHOOTS']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ensureTroubleTicketTable().catch(() => {})

  const { id } = await params
  const ticketId = toInt(id)
  if (!ticketId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const targetRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT "id"
       FROM "TroubleTicket"
       WHERE "id" = $1 OR "ticketNumber" = $1
       ORDER BY "openedAt" DESC
       LIMIT 1;`,
      ticketId
    )
    const targetId = targetRows[0]?.id
    if (!targetId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await request.formData()
    const closeNotes = String(formData.get('closeNotes') ?? '').trim()
    const rawFiles = formData.getAll('photos')
    const files = rawFiles.filter((x): x is File => x instanceof File)
    const normalized = normalizePhotos(files)
    if (!closeNotes) return NextResponse.json({ error: 'Penanganan wajib diisi' }, { status: 400 })
    if (normalized.length === 0) return NextResponse.json({ error: 'Upload minimal 1 foto penanganan' }, { status: 400 })

    const photos: string[] = []
    for (const file of normalized) {
      const buffer = Buffer.from(await file.arrayBuffer())
      photos.push(`data:${file.type};base64,${buffer.toString('base64')}`)
    }

    const closeBy = String(session.user.name ?? session.user.username ?? '').trim() || null
    const closeNotesVal = closeNotes || null
    const closePhotosVal = photos.length ? photos : null
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `UPDATE "TroubleTicket"
       SET "status" = 'CLOSE',
           "closedAt" = NOW(),
           "closeNotes" = $2,
           "closePhotos" = $3,
           "closeBy" = $4,
           "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING "id";`,
      targetId,
      closeNotesVal,
      closePhotosVal,
      closeBy
    )
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg || 'Failed to close ticket' }, { status: 500 })
  }
}
