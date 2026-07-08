import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canMutateMenu } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleHistoryTable } from '@/lib/dismantle-history'
import { prisma } from '@/lib/prisma'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'
import { ensureDismantleTicketsTable, getDismantleTicketById } from '@/lib/dismantle-tickets'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureIsolationColumnsOnce()
  await ensureDismantleHistoryTable()
  await ensureDismantleTicketsTable()

  try {
    const form = await request.formData()
    const dismantleTicketId = parseInt(String(form.get('dismantleTicketId') ?? ''), 10)
    const isolationId = parseInt(String(form.get('isolationId') ?? ''), 10)
    const useDismantleTicket = Number.isFinite(dismantleTicketId)
    if (!useDismantleTicket && !Number.isFinite(isolationId)) {
      return NextResponse.json({ error: 'Data dismantle tidak valid' }, { status: 400 })
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

    const existing = useDismantleTicket ? await getDismantleTicketById(dismantleTicketId) : null
    const existingIsolation = !useDismantleTicket
      ? await (prisma as any).isolation.findUnique({
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
      : null

    if (useDismantleTicket && !existing) {
      return NextResponse.json({ error: 'Data dismantle tidak ditemukan' }, { status: 404 })
    }
    if (!useDismantleTicket && !existingIsolation) {
      return NextResponse.json({ error: 'Data isolir tidak ditemukan' }, { status: 404 })
    }

    const now = new Date()
    await prisma.$transaction(async (tx) => {
      const base = useDismantleTicket
        ? {
            sourceIsolationId: existing?.sourceIsolationId ?? null,
            customerName: existing?.customerName ?? '',
            customerAddress: existing?.customerAddress ?? null,
            customerPhone: existing?.customerPhone ?? null,
            userEmail: existing?.userEmail ?? null,
            marketing: existing?.marketing ?? null,
            radboox: existing?.radboox ?? null,
            isolationDate: existing?.isolationDate ? new Date(existing.isolationDate) : now,
            reason: existing?.reason ?? null,
            ticketDismantle: ticketDismantle ?? (existing ? String(existing.ticketNumber ?? '').trim() || null : null),
            ticketId: null,
            ticketLocationMap: null,
            ticketDescription: null,
          }
        : {
            sourceIsolationId: existingIsolation?.id ?? null,
            customerName: existingIsolation?.customerName ?? '',
            customerAddress: existingIsolation?.customerAddress ?? null,
            customerPhone: existingIsolation?.customerPhone ?? null,
            userEmail: existingIsolation?.userEmail ?? null,
            marketing: existingIsolation?.marketing ?? null,
            radboox: existingIsolation?.radboox ?? null,
            isolationDate: existingIsolation?.isolationDate ? new Date(existingIsolation.isolationDate) : now,
            reason: existingIsolation?.reason ?? null,
            ticketDismantle:
              ticketDismantle ??
              (typeof existingIsolation?.ticketDismantle === 'string' ? existingIsolation.ticketDismantle : null),
            ticketId: typeof existingIsolation?.ticketId === 'number' ? existingIsolation.ticketId : null,
            ticketLocationMap: existingIsolation?.ticket?.locationMap ?? null,
            ticketDescription: existingIsolation?.ticket?.description ?? null,
          }

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
        base.sourceIsolationId,
        base.customerName,
        base.customerAddress,
        base.customerPhone,
        base.userEmail,
        base.marketing,
        base.radboox,
        base.isolationDate,
        base.reason,
        base.ticketDismantle,
        base.ticketId,
        base.ticketLocationMap,
        base.ticketDescription,
        closeNote,
        closePhotoDataUri,
        now,
        session.user.name ?? null,
        now,
        now,
      )

      if (useDismantleTicket) {
        await tx.$executeRawUnsafe(`DELETE FROM "DismantleTickets" WHERE "id" = $1`, dismantleTicketId)
      } else {
        await (tx as any).isolation.update({
          where: { id: isolationId },
          data: {
            status: 'CLOSED',
            ticketDismantle:
              ticketDismantle ?? (typeof existingIsolation?.ticketDismantle === 'string' ? existingIsolation.ticketDismantle : null),
            closeNote,
            closePhoto: closePhotoDataUri,
            restorationDate: now,
            isArchived: true,
            archivedAt: now,
          },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to close dismantle ticket:', error)
    return NextResponse.json({ error: 'Failed to close dismantle ticket' }, { status: 500 })
  }
}
