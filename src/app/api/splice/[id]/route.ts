import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { ensureMenuMutation } from '@/lib/access-server'
import { ensureSpliceKmlIconStyleColumn } from '@/lib/splice-kml-schema'

export const runtime = 'nodejs'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuMutation(session, 'jalur')
  if (accessError) return accessError

  try {
    await ensureSpliceKmlIconStyleColumn()
    const { id } = await params
    const spliceId = Number(id)
    if (!Number.isFinite(spliceId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    await prisma.splice.delete({ where: { id: spliceId } })
    cache.invalidateByPrefix('splice:')
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'Gagal menghapus splice' }, { status: 500 })
  }
}
