
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { getSession } from '@/lib/auth'
import { ensureMenuMutation } from '@/lib/access-server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'settings')
  if (accessError) return accessError

  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    await prisma.priority.delete({
      where: { id },
    })
    cache.invalidateByPrefix('priorities:')
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Error deleting priority' },
      { status: 500 }
    )
  }
}
