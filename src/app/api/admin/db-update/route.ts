import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user.role || '').toUpperCase() !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requiredKey = process.env.DB_UPDATE_KEY
  if (!requiredKey) {
    return NextResponse.json(
      { error: 'DB_UPDATE_KEY belum diset di environment' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const key = String(searchParams.get('key') ?? '')
  if (key !== requiredKey) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 })
  }

  try {
    const executed: string[] = []

    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" TEXT;`)
    executed.push('User.avatar')

    return NextResponse.json({ ok: true, executed })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg || 'DB update failed' }, { status: 500 })
  }
}
