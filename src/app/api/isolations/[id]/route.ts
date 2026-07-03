import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

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

  const ensureIsolationColumns = async () => {
    await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "ticketDismantle" TEXT').catch(() => {})
    await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "price" DECIMAL(15,2)').catch(() => {})
    await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "closeNote" TEXT').catch(() => {})
    await prisma.$executeRawUnsafe('ALTER TABLE "Isolation" ADD COLUMN IF NOT EXISTS "closePhoto" TEXT').catch(() => {})
  }

  const isMissingColumn = (e: unknown, column: string) => {
    if (typeof e !== 'object' || !e) return false
    const anyErr = e as { code?: unknown; message?: unknown }
    const code = typeof anyErr.code === 'string' ? anyErr.code : ''
    const msg = typeof anyErr.message === 'string' ? anyErr.message : ''
    return code === 'P2022' && msg.toLowerCase().includes(column.toLowerCase())
  }

  const contentType = request.headers.get('content-type') || ''
  const isMultipart = contentType.includes('multipart/form-data')

  let body: Record<string, unknown> = {}
  let closePhotoDataUri: string | undefined

  if (isMultipart) {
    await ensureIsolationColumns()
    const form = await request.formData()
    const getStr = (k: string) => {
      const v = form.get(k)
      if (v == null) return undefined
      if (typeof v === 'string') return v
      return undefined
    }

    body = {
      customerName: getStr('customerName'),
      customerAddress: getStr('customerAddress'),
      customerPhone: getStr('customerPhone'),
      userEmail: getStr('userEmail'),
      activeDate: getStr('activeDate'),
      marketing: getStr('marketing'),
      radboox: getStr('radboox'),
      price: getStr('price'),
      reason: getStr('reason'),
      teknisi: getStr('teknisi'),
      ticketDismantle: getStr('ticketDismantle'),
      ticketId: getStr('ticketId'),
      status: getStr('status'),
      closeNote: getStr('closeNote'),
    }

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
  } else {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>
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
    const data: any = {
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
      closeNote: normalizeOptionalString((body as any).closeNote),
      closePhoto: closePhotoDataUri,
      status,
      restorationDate: status === 'CLOSED' ? new Date() : status === 'OPEN' ? null : undefined,
    }

    let isolation: any
    try {
      isolation = await (prisma as any).isolation.update({
        where: { id: isolationId },
        data,
      })
    } catch (e) {
      const dataFallback: any = { ...data }
      if (isMissingColumn(e, 'price')) delete dataFallback.price
      if (isMissingColumn(e, 'closeNote')) delete dataFallback.closeNote
      if (isMissingColumn(e, 'closePhoto')) delete dataFallback.closePhoto
      if (dataFallback.price === data.price && dataFallback.closeNote === data.closeNote && dataFallback.closePhoto === data.closePhoto) {
        throw e
      }
      isolation = await (prisma as any).isolation.update({
        where: { id: isolationId },
        data: dataFallback,
      })
    }

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
