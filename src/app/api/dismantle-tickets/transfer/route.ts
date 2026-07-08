import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canMutateMenu } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleTicketsTable } from '@/lib/dismantle-tickets'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateMenu(session.user.role, 'isolir')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureIsolationColumnsOnce()
  await ensureDismantleTicketsTable()

  try {
    const body = (await request.json().catch(() => ({}))) as { isolationId?: unknown }
    const isolationIdRaw = body?.isolationId
    const isolationId =
      typeof isolationIdRaw === 'number'
        ? Math.trunc(isolationIdRaw)
        : typeof isolationIdRaw === 'string'
          ? parseInt(isolationIdRaw, 10)
          : NaN
    if (!Number.isFinite(isolationId)) {
      return NextResponse.json({ error: 'ID isolir tidak valid' }, { status: 400 })
    }

    const isolation = await prisma.isolation.findUnique({
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
        status: true,
        isArchived: true,
      },
    })
    if (!isolation) {
      return NextResponse.json({ error: 'Data isolir tidak ditemukan' }, { status: 404 })
    }
    if (String(isolation.status ?? '').toUpperCase() !== 'OPEN') {
      return NextResponse.json({ error: 'Hanya data OPEN yang bisa di-transfer ke dismantle' }, { status: 400 })
    }
    if (isolation.isArchived) {
      return NextResponse.json({ error: 'Data ini sudah diarsipkan' }, { status: 400 })
    }

    const now = new Date()
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
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
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN',NULL,$10,$10)
        ON CONFLICT ("sourceIsolationId")
        DO UPDATE SET
          "customerName" = EXCLUDED."customerName",
          "customerAddress" = EXCLUDED."customerAddress",
          "customerPhone" = EXCLUDED."customerPhone",
          "userEmail" = EXCLUDED."userEmail",
          "marketing" = EXCLUDED."marketing",
          "radboox" = EXCLUDED."radboox",
          "isolationDate" = EXCLUDED."isolationDate",
          "reason" = EXCLUDED."reason",
          "status" = 'OPEN',
          "updatedAt" = EXCLUDED."updatedAt"
        RETURNING "id"
      `,
      isolation.id,
      isolation.customerName,
      isolation.customerAddress ?? null,
      isolation.customerPhone ?? null,
      isolation.userEmail ?? null,
      isolation.marketing ?? null,
      isolation.radboox ?? null,
      isolation.isolationDate ? new Date(isolation.isolationDate) : now,
      isolation.reason ?? null,
      now,
    )

    const id = Number(rows[0]?.id ?? 0)
    return NextResponse.json({ success: true, dismantleTicketId: id })
  } catch (error) {
    console.error('Failed to transfer to dismantle:', error)
    return NextResponse.json({ error: 'Failed to transfer to dismantle' }, { status: 500 })
  }
}

