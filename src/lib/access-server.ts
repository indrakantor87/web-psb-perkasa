import { NextResponse } from 'next/server'
import type { SessionData } from '@/lib/auth'
import { canAccessMenu, canMutateMenu, type AppMenuKey } from '@/lib/access'

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function ensureMenuAccess(session: SessionData | null, menu: AppMenuKey) {
  if (!session) return unauthorizedResponse()
  if (!canAccessMenu(session.user.role, menu)) return forbiddenResponse()
  return null
}

export function ensureMenuMutation(session: SessionData | null, menu: AppMenuKey) {
  if (!session) return unauthorizedResponse()
  if (!canAccessMenu(session.user.role, menu) || !canMutateMenu(session.user.role, menu)) {
    return forbiddenResponse()
  }
  return null
}

export function requireSession(session: SessionData | null): SessionData {
  if (!session) {
    throw new Error('Session is required')
  }
  return session
}
