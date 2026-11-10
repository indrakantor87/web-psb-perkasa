import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'
import { saveDailyActivityProfile } from '@/lib/daily-activity-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  const session = await getSession()
  const mutationError = ensureMenuMutation(session, 'daily-activity')
  if (mutationError) return mutationError

  try {
    const body = await request.json()
    const profile = await saveDailyActivityProfile(requireSession(session).user, {
      division: body?.division ?? null,
      subdivision: body?.subdivision ?? null,
      planningLevel: body?.planningLevel ?? null,
      userId: body?.userId ?? null,
    })

    return NextResponse.json({ profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan profil'
    console.error('Failed to save daily activity profile:', error)
    const status = message.includes('tidak ditemukan') ? 404 : message.includes('berhak') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function GET() {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'daily-activity')
  if (accessError) return accessError

  return NextResponse.json({ ok: true, user: requireSession(session).user.name })
}
