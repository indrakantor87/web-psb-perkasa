import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canMutateMenu } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleHistoryTable } from '@/lib/dismantle-history'

export const runtime = 'nodejs'

async function ensureIsolationColumns() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "ticketDismantle" TEXT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "closeNote" TEXT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "closePhoto" TEXT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT FALSE').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)').catch(() => {})
  await prisma.$executeRawUnsafe('UPDATE "Isolation" SET "isArchived" = FALSE WHERE "isArchived" IS NULL').catch(() => {})
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureIsolationColumns()
  await ensureDismantleHistoryTable()

  try {
    const form = await request.formData()
    const isolationId = parseInt(String(form.get('isolationId') ?? ''), 10)
    if (!Number.isFinite(isolationId)) {
      return NextResponse.json({ error: 'Data isolir tidak valid' }, { status: 400 })
    }

    const closeNoteRaw = form.get('closeNote')
    const closeNote = typeof closeNoteRaw === 'string' && closeNoteRaw.trim() !== '' ? closeNoteRaw.trim() : null
    const ticketInput = form.get('ticketDismantle')
    const ticketDismantle =
      typeof ticketInput === 'string' && ticketInput.trim() !== '' ? ticketInput.trim() : null

    let closePhotoDataUri: string | null = null
    const file = form.get('closePhoto')
    if (file instanceof File && file.size > 0) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg']
      if (!validTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Tipe foto tidak valid (jpg/png)' }, { status: 400 })
      }
      if (file.size > 3 * 1024 * 1024) {
        return NextResponse.json({ error: 'Ukuran foto terlalu besar (maks 3MB)' }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      closePhotoDataUri = `data:${file.type};base64,${buffer.toString('base64')}`
    }

    const existing = await (prisma as any).isolation.findUnique({
      where: { id: isolationId },
      select: {
        id: true,
        customerName: true,
        customerAddress: true,
        customerPhone: true,
        userEmail: true,
        marketing: true,
        radboox: true,
        isolationDate: true,
        reason: true,
        ticketDismantle: true,
        ticketId: true,
        ticket: {
          select: {
            locationMap: true,
            description: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Data isolir tidak ditemukan' }, { status: 404 })
    }

    const now = new Date()
    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `
          INSERT INTO "DismantleHistory" (
            "sourceIsolationId",
            "customerName",
            "customerAddress",
            "customerPhone",
            "userEmail",
            "marketing",
            "radboox",
            "isolationDate",
            "reason",
            "ticketDismantle",
            "ticketId",
            "ticketLocationMap",
            "ticketDescription",
            "closeNote",
            "closePhoto",
            "closedAt",
            "closedBy",
            "createdAt",
            "updatedAt"
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
          )
        `,
        existing.id,
        existing.customerName,
        existing.customerAddress ?? null,
        existing.customerPhone ?? null,
        existing.userEmail ?? null,
        existing.marketing ?? null,
        existing.radboox ?? null,
        existing.isolationDate ? new Date(existing.isolationDate) : now,
        existing.reason ?? null,
        ticketDismantle ?? (typeof existing.ticketDismantle === 'string' ? existing.ticketDismantle : null),
        typeof existing.ticketId === 'number' ? existing.ticketId : null,
        existing.ticket?.locationMap ?? null,
        existing.ticket?.description ?? null,
        closeNote,
        closePhotoDataUri,
        now,
        session.user.name ?? null,
        now,
        now,
      )

      await (tx as any).isolation.update({
        where: { id: isolationId },
        data: {
          status: 'CLOSED',
          ticketDismantle: ticketDismantle ?? (typeof existing.ticketDismantle === 'string' ? existing.ticketDismantle : null),
          closeNote,
          closePhoto: closePhotoDataUri,
          restorationDate: now,
          isArchived: true,
          archivedAt: now,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to close dismantle ticket:', error)
    return NextResponse.json({ error: 'Failed to close dismantle ticket' }, { status: 500 })
  }
}
