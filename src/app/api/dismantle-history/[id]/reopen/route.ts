import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canMutateMenu } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleHistoryTable, getDismantleHistoryById } from '@/lib/dismantle-history'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'
import { ensureDismantleTicketsTable } from '@/lib/dismantle-tickets'

export const runtime = 'nodejs'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureIsolationColumnsOnce()
  await ensureDismantleHistoryTable()
  await ensureDismantleTicketsTable()

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
              ticketDismantle: null,
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
            ticketDismantle: null,
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

      await tx.$executeRawUnsafe(
        `
          INSERT INTO "DismantleTickets" (
            "sourceIsolationId",
            "customerName",
            "customerAddress",
            "customerPhone",
            "userEmail",
            "marketing",
            "radboox",
            "isolationDate",
            "reason",
            "status",
            "ticketNumber",
            "createdAt",
            "updatedAt"
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN',$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
          )
          ON CONFLICT ("sourceIsolationId") WHERE "sourceIsolationId" IS NOT NULL
          DO UPDATE SET
            "customerName" = EXCLUDED."customerName",
            "customerAddress" = EXCLUDED."customerAddress",
            "customerPhone" = EXCLUDED."customerPhone",
            "userEmail" = EXCLUDED."userEmail",
            "marketing" = EXCLUDED."marketing",
            "radboox" = EXCLUDED."radboox",
            "isolationDate" = EXCLUDED."isolationDate",
            "reason" = EXCLUDED."reason",
            "ticketNumber" = EXCLUDED."ticketNumber",
            "status" = 'OPEN',
            "updatedAt" = CURRENT_TIMESTAMP
        `,
        reopenedIsolationId,
        history.customerName,
        history.customerAddress ?? null,
        history.customerPhone ?? null,
        history.userEmail ?? null,
        history.marketing ?? null,
        history.radboox ?? null,
        history.isolationDate ? new Date(history.isolationDate) : new Date(),
        history.reason ?? null,
        history.ticketDismantle ?? null,
      )

      await tx.$executeRawUnsafe(`DELETE FROM "DismantleHistory" WHERE "id" = $1`, historyId)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reopen dismantle history:', error)
    return NextResponse.json({ error: 'Failed to reopen dismantle history' }, { status: 500 })
  }
}
