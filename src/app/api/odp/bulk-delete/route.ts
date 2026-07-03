import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { cache } from '@/lib/cache'
import { ensureOdpTable } from '@/lib/odp-init'
import { ensureMenuMutation } from '@/lib/access-server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'odp')
  if (accessError) return accessError

  await ensureOdpTable()

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown }
  const idsRaw = Array.isArray(body.ids) ? body.ids : []
  const ids = Array.from(
    new Set(
      idsRaw
        .map((x) => (typeof x === 'number' ? Math.trunc(x) : typeof x === 'string' ? parseInt(x, 10) : NaN))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  )

  if (ids.length === 0) return NextResponse.json({ ok: true, count: 0 })
  if (ids.length > 5000) return NextResponse.json({ error: 'Terlalu banyak data dipilih' }, { status: 400 })

  const values = Prisma.join(ids.map((id) => Prisma.sql`${id}`))
  const count = await prisma.$executeRaw(Prisma.sql`
    UPDATE psb_odp
    SET is_active = FALSE, updated_at = NOW()
    WHERE id IN (${values})
  `)

  cache.invalidateByPrefix('odp:')
  return NextResponse.json({ ok: true, count })
}
