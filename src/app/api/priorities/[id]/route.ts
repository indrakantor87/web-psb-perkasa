
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
