import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canMutateMenu } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleHistoryTable, getDismantleHistoryById } from '@/lib/dismantle-history'

export const runtime = 'nodejs'

async function ensureIsolationColumns() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "ticketDismantle" TEXT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "price" DECIMAL(15,2)').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "closeNote" TEXT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "closePhoto" TEXT').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT FALSE').catch(() => {})
  await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)').catch(() => {})
  await prisma.$executeRawUnsafe('UPDATE "Isolation" SET "isArchived" = FALSE WHERE "isArchived" IS NULL').catch(() => {})
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureIsolationColumns()
  await ensureDismantleHistoryTable()

  const resolvedParams = await params
  const historyId = parseInt(resolvedParams.id, 10)
  if (!Number.isFinite(historyId)) {
    return NextResponse.json({ error: 'ID history tidak valid' }, { status: 400 })
  }

  try {
    const history = await getDismantleHistoryById(historyId)
    if (!history) {
      return NextResponse.json({ error: 'Riwayat dismantle tidak ditemukan' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      const txAny = tx as any
      let reopenedIsolationId: number | null = null

      if (history.sourceIsolationId != null) {
        const existingIsolation = await txAny.isolation.findUnique({
          where: { id: Number(history.sourceIsolationId) },
          select: { id: true },
        })

        if (existingIsolation) {
          reopenedIsolationId = Number(existingIsolation.id)
          await txAny.isolation.update({
            where: { id: reopenedIsolationId },
            data: {
              customerName: history.customerName,
              customerAddress: history.customerAddress ?? null,
              customerPhone: history.customerPhone ?? null,
              userEmail: history.userEmail ?? null,
              marketing: history.marketing ?? null,
              radboox: history.radboox ?? null,
              reason: history.reason ?? null,
              ticketDismantle: history.ticketDismantle ?? null,
              ticketId: history.ticketId == null ? null : Number(history.ticketId),
              status: 'OPEN',
              restorationDate: null,
              closeNote: null,
              closePhoto: null,
              isArchived: false,
              archivedAt: null,
            },
          })
        }
      }

      if (reopenedIsolationId == null) {
        const created = await txAny.isolation.create({
          data: {
            customerName: history.customerName,
            customerAddress: history.customerAddress ?? null,
            customerPhone: history.customerPhone ?? null,
            userEmail: history.userEmail ?? null,
            marketing: history.marketing ?? null,
            radboox: history.radboox ?? null,
            reason: history.reason ?? null,
            isolationDate: history.isolationDate ? new Date(history.isolationDate) : new Date(),
            ticketDismantle: history.ticketDismantle ?? null,
            ticketId: history.ticketId == null ? null : Number(history.ticketId),
            status: 'OPEN',
            restorationDate: null,
            closeNote: null,
            closePhoto: null,
            isArchived: false,
            archivedAt: null,
          },
        })
        reopenedIsolationId = Number(created.id)
      }

      await tx.$executeRawUnsafe(`DELETE FROM "DismantleHistory" WHERE "id" = $1`, historyId)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reopen dismantle history:', error)
    return NextResponse.json({ error: 'Failed to reopen dismantle history' }, { status: 500 })
  }
}
