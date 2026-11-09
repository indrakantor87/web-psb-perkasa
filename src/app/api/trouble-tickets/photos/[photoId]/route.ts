import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPhotoRow, readPhotoFile } from '@/lib/trouble-ticket-photo-store'
import { canAccessTroubleTicketRecords } from '@/lib/access'

export const runtime = 'nodejs'

function toInt(v: string) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (!canAccessTroubleTicketRecords(session.user.role)) return new Response('Forbidden', { status: 403 })

  const { photoId } = await params
  const id = toInt(photoId)
  if (!id) return new Response('Invalid id', { status: 400 })

  const row = await getPhotoRow(id)
  if (!row) return new Response('Not found', { status: 404 })
  if (String(session.user.role ?? '').trim().toUpperCase() === 'MARKETING') {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TroubleTicket" ADD COLUMN IF NOT EXISTS "createdById" INTEGER;`)
    const owners = await prisma.$queryRawUnsafe<Array<{ createdById: number | null }>>(
      `SELECT "createdById" FROM "TroubleTicket" WHERE "id" = $1 LIMIT 1;`,
      row.ticketId
    )
    if (Number(owners[0]?.createdById) !== session.user.id) {
      return new Response('Not found', { status: 404 })
    }
  }

  const buf = await readPhotoFile(row.filePath)
  if (!buf) return new Response('Not found', { status: 404 })

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': row.mimeType || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
    },
  })
}
