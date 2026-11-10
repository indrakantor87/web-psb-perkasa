import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuMutation, requireSession } from '@/lib/access-server'
import { closeDailyActivityItem, deleteDailyActivityItem } from '@/lib/daily-activity-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const mutationError = ensureMenuMutation(session, 'daily-activity')
  if (mutationError) return mutationError

  const { id } = await params
  const itemId = Number(id)
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ error: 'ID aktivitas tidak valid' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const item = await closeDailyActivityItem(requireSession(session).user, itemId, {
      executionStatus: String(body?.executionStatus ?? 'DONE'),
      progressPercent: body?.progressPercent ?? null,
      resultNote: body?.resultNote ?? null,
      obstacleNote: body?.obstacleNote ?? null,
      submitApproval: body?.submitApproval === true,
    })

    return NextResponse.json({ item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui aktivitas'
    console.error('Failed to update daily activity:', error)
    const status = message.includes('tidak ditemukan') ? 404 : message.includes('berhak') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const mutationError = ensureMenuMutation(session, 'daily-activity')
  if (mutationError) return mutationError

  const { id } = await params
  const itemId = Number(id)
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ error: 'ID aktivitas tidak valid' }, { status: 400 })
  }

  try {
    await deleteDailyActivityItem(requireSession(session).user, itemId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus aktivitas'
    console.error('Failed to delete daily activity:', error)
    const status = message.includes('tidak ditemukan') ? 404 : message.includes('berhak') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
