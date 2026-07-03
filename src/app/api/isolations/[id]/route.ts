import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role === 'TEKNISI') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Restrict MARKETING from updating isolations
  if (session.user.role === 'MARKETING') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const isolationId = parseInt(id, 10)
  if (!Number.isFinite(isolationId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const normalizeOptionalString = (v: unknown) => {
    if (typeof v !== 'string') return undefined
    const s = v.trim()
    return s === '' ? null : s
  }

  const normalizeOptionalDate = (v: unknown) => {
    if (v == null) return undefined
    if (typeof v !== 'string' && typeof v !== 'number') return undefined
    const s = String(v).trim()
    if (!s) return null
    const d = new Date(s)
    if (!Number.isFinite(d.getTime())) return 'INVALID'
    return d
  }

  const statusRaw = typeof body.status === 'string' ? body.status.trim().toUpperCase() : undefined
  const status = statusRaw === 'OPEN' || statusRaw === 'CLOSED' ? statusRaw : undefined
  const activeDateParsed = normalizeOptionalDate(body.activeDate)
  if (activeDateParsed === 'INVALID') {
    return NextResponse.json({ error: 'Active Date tidak valid' }, { status: 400 })
  }

  const ticketIdRaw = body.ticketId
  const ticketId =
    typeof ticketIdRaw === 'number'
      ? Math.trunc(ticketIdRaw)
      : typeof ticketIdRaw === 'string' && ticketIdRaw.trim() !== ''
        ? parseInt(ticketIdRaw, 10)
        : undefined

  const priceRaw = body.price
  let price: Prisma.Decimal | null | undefined
  if (priceRaw === null || priceRaw === '') {
    price = null
  } else if (priceRaw !== undefined) {
    const num = parseFloat(String(priceRaw))
    if (!isNaN(num)) {
      price = new Prisma.Decimal(num)
    }
  } else {
    price = undefined
  }

  try {
    const isolation = await (prisma as any).isolation.update({
      where: { id: isolationId },
      data: {
        customerName: typeof body.customerName === 'string' ? body.customerName : undefined,
        customerAddress: normalizeOptionalString(body.customerAddress),
        customerPhone: normalizeOptionalString(body.customerPhone),
        userEmail: normalizeOptionalString(body.userEmail),
        activeDate: activeDateParsed === undefined ? undefined : activeDateParsed,
        marketing: normalizeOptionalString(body.marketing),
        radboox: normalizeOptionalString(body.radboox),
        price,
        reason: normalizeOptionalString(body.reason),
        teknisi: normalizeOptionalString(body.teknisi),
        ticketDismantle: normalizeOptionalString(body.ticketDismantle),
        ticketId: Number.isFinite(ticketId as number) ? (ticketId as number) : ticketId === null ? null : undefined,
        status,
        restorationDate: status === 'CLOSED' ? new Date() : status === 'OPEN' ? null : undefined,
      },
    })

    return NextResponse.json(isolation)
  } catch (error) {
    console.error('Failed to update isolation:', error)
    const code =
      typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code ?? '') : ''
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Data isolir tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update isolation' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role === 'TEKNISI') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Allow ADMIN, CS, NOC to delete
  if (!['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    await (prisma as any).isolation.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete isolation:', error)
    return NextResponse.json({ error: 'Failed to delete isolation' }, { status: 500 })
  }
}
