import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import { ensureMenuMutation } from '@/lib/access-server'

export const runtime = 'nodejs'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuMutation(session, 'jalur')
  if (accessError) return accessError

  try {
    const { id } = await params
    const jalurId = Number(id)
    if (!Number.isFinite(jalurId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    await prisma.splice.updateMany({
      where: { jalur_id: jalurId },
      data: { jalur_id: null },
    })
    await prisma.jalur.delete({ where: { id: jalurId } })

    cache.invalidateByPrefix('jalur:')
    cache.invalidateByPrefix('splice:')
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'Gagal menghapus jalur' }, { status: 500 })
  }
}
