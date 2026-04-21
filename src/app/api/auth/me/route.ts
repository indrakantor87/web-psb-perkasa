import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ user: null })
  }
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatar: true },
    })
    return NextResponse.json({ user: { ...session.user, avatar: dbUser?.avatar ?? null } })
  } catch {
    return NextResponse.json({ user: { ...session.user, avatar: null } })
  }
}
