import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canMutateMenu } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleHistoryTable } from '@/lib/dismantle-history'
import { prisma } from '@/lib/prisma'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'
import { ensureDismantleTicketsTable, getDismantleTicketById } from '@/lib/dismantle-tickets'
import { adjustOdpTerpakai, resolveTicketOdpPort } from '@/lib/odp-usage'

export const runtime = 'nodejs'

function normalizePhotos(files: File[]) {
  const limited = files.slice(0, 10)
  const validTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
  ])
  for (const file of limited) {
    if (!validTypes.has(file.type)) throw new Error(`Format file tidak didukung: ${file.type}`)
    if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran file maksimal 10MB')
  }
  return limited
}

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

    // Override manual ODP/port (opsional). Bila kosong, diwarisi dari tiket PSB terkait.
    const odpIdInput = form.get('odpId')
    const odpIdOverride =
      odpIdInput != null && String(odpIdInput).trim() !== '' ? parseInt(String(odpIdInput), 10) : NaN
    const portInput = form.get('portNumber')
    const portNumberOverride =
      portInput != null && String(portInput).trim() !== '' ? parseInt(String(portInput), 10) : NaN

    const rawFiles = form.getAll('closePhotos')
    const files = rawFiles.filter((entry): entry is File => {
      return typeof entry !== 'string' && typeof (entry as File).arrayBuffer === 'function' && entry.size > 0
    })
    const fallbackFile = form.get('closePhoto')
    if (files.length === 0 && fallbackFile instanceof File && fallbackFile.size > 0) {
      files.push(fallbackFile)
    }
    const normalizedPhotos = normalizePhotos(files)
    const closePhotoDataUris = await Promise.all(
      normalizedPhotos.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer())
        return `data:${file.type};base64,${buffer.toString('base64')}`
      }),
    )
    const primaryClosePhoto = closePhotoDataUris[0] ?? null

    const existing = useDismantleTicket ? await getDismantleTicketById(dismantleTicketId) : null
    const existingIsolation = !useDismantleTicket
      ? await prisma.isolation.findUnique({
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

    // Tentukan ODP/port yang dibebaskan: override manual > record dismantle > tiket PSB tertaut.
    let resolvedOdpId = Number.isFinite(odpIdOverride) ? odpIdOverride : null
    let resolvedPortNumber = Number.isFinite(portNumberOverride) ? portNumberOverride : null

    if (resolvedOdpId == null && useDismantleTicket && existing?.odpId != null) {
      resolvedOdpId = Number(existing.odpId)
    }
    if (resolvedPortNumber == null && useDismantleTicket && existing?.portNumber != null) {
      resolvedPortNumber = Number(existing.portNumber)
    }

    if (resolvedOdpId == null) {
      let linkedTicketId: number | null = null
      if (useDismantleTicket) {
        if (existing?.sourceIsolationId != null) {
          const linkedIsolation = await prisma.isolation.findUnique({
            where: { id: Number(existing.sourceIsolationId) },
            select: { ticketId: true },
          })
          linkedTicketId = typeof linkedIsolation?.ticketId === 'number' ? linkedIsolation.ticketId : null
        }
      } else {
        linkedTicketId = typeof existingIsolation?.ticketId === 'number' ? existingIsolation.ticketId : null
      }
      const linked = await resolveTicketOdpPort(linkedTicketId)
      resolvedOdpId = linked.odpId
      if (resolvedPortNumber == null) resolvedPortNumber = linked.portNumber
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
            odpId: resolvedOdpId,
            portNumber: resolvedPortNumber,
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
            odpId: resolvedOdpId,
            portNumber: resolvedPortNumber,
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
            "closePhotos",
            "closedAt",
            "closedBy",
            "createdAt",
            "updatedAt",
            "odpId",
            "portNumber"
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
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
        primaryClosePhoto,
        closePhotoDataUris.length > 0 ? closePhotoDataUris : null,
        now,
        session.user.name ?? null,
        now,
        now,
        base.odpId,
        base.portNumber,
      )

      // Dismantle = perangkat dibongkar, port ODP kembali bebas.
      if (resolvedOdpId != null) {
        await adjustOdpTerpakai(resolvedOdpId, -1, tx)
      }

      if (useDismantleTicket) {
        await tx.$executeRawUnsafe(`DELETE FROM "DismantleTickets" WHERE "id" = $1`, dismantleTicketId)
      } else {
        await tx.isolation.update({
          where: { id: isolationId },
          data: {
            status: 'CLOSED',
            ticketDismantle:
              ticketDismantle ?? (typeof existingIsolation?.ticketDismantle === 'string' ? existingIsolation.ticketDismantle : null),
            closeNote,
            closePhoto: primaryClosePhoto,
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
