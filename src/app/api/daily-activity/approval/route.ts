import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuMutation, requireSession } from '@/lib/access-server'
import { reviewDailyActivityItems, type DailyActivityApprovalDecision } from '@/lib/daily-activity-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSession()
  const mutationError = ensureMenuMutation(session, 'daily-activity')
  if (mutationError) return mutationError

  try {
    const body = await request.json()
    const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [body?.id]
    const ids = rawIds.map((value) => Number(value)).filter((value) => Number.isFinite(value))

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Tidak ada aktivitas yang dipilih' }, { status: 400 })
    }

    const decision: DailyActivityApprovalDecision = body?.decision === 'REJECT' ? 'REJECT' : 'APPROVE'

    const result = await reviewDailyActivityItems(
      requireSession(session).user,
      ids,
      decision,
      body?.note ?? null
    )

    if (result.approved === 0 && result.rejected === 0) {
      return NextResponse.json(
        { error: 'Tidak ada aktivitas yang dapat diproses (cek level & divisi approval)', ...result },
        { status: 403 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to review daily activity:', error)
    return NextResponse.json({ error: 'Gagal memproses approval' }, { status: 500 })
  }
}
