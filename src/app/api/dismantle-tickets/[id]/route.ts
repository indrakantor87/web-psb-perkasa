import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canMutateMenu } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureDismantleTicketsTable } from '@/lib/dismantle-tickets'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function normalizeOptionalString(value: unknown) {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized === '' ? null : normalized
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureDismantleTicketsTable()

  const { id } = await context.params
  const ticketId = parseInt(String(id ?? ''), 10)
  if (!Number.isFinite(ticketId)) {
    return NextResponse.json({ error: 'ID dismantle tidak valid' }, { status: 400 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : ''
    if (!customerName) {
      return NextResponse.json({ error: 'Nama pelanggan wajib diisi' }, { status: 400 })
    }

    const now = new Date()
    const updated = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `
        UPDATE "DismantleTickets"
        SET
          "customerName" = $2,
          "customerAddress" = $3,
          "customerPhone" = $4,
          "userEmail" = $5,
          "marketing" = $6,
          "radboox" = $7,
          "reason" = $8,
          "fieldNote" = $9,
          "ticketNumber" = $10,
          "updatedAt" = $11
        WHERE "id" = $1
        RETURNING "id"
      `,
      ticketId,
      customerName,
      normalizeOptionalString(body.customerAddress),
      normalizeOptionalString(body.customerPhone),
      normalizeOptionalString(body.userEmail),
      normalizeOptionalString(body.marketing),
      normalizeOptionalString(body.radboox),
      normalizeOptionalString(body.reason),
      normalizeOptionalString((body as any).fieldNote),
      normalizeOptionalString((body as any).ticketNumber),
      now,
    )

    if (!updated[0]?.id) {
      return NextResponse.json({ error: 'Data dismantle tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update dismantle ticket:', error)
    return NextResponse.json({ error: 'Failed to update dismantle ticket' }, { status: 500 })
  }
}
