import { prisma } from '@/lib/prisma'
import { login } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validations'
import { ensureUserDivisionColumn } from '@/lib/db-init'
import { logSecurityEvent } from '@/lib/security-log'

function getLocalDemoUser(username: string) {
  const normalized = String(username ?? '').trim().toLowerCase()
  const demoUsers = {
    admin: { id: 0, name: 'Admin', username: 'admin', role: 'ADMIN', division: null },
    cs: { id: -1, name: 'Customer Service', username: 'cs', role: 'CS', division: 'CS_ADMIN' },
    noc: { id: -2, name: 'NOC User', username: 'noc', role: 'NOC', division: 'NOC_TROUBLESHOOTS' },
    marketing: { id: -3, name: 'Marketing User', username: 'marketing', role: 'MARKETING', division: 'PENJUALAN' },
    teknisi: { id: -4, name: 'Teknisi User', username: 'teknisi', role: 'TEKNISI', division: 'NOC_TROUBLESHOOTS' },
    dismantle: { id: -5, name: 'Dismantle User', username: 'dismantle', role: 'DISMANTLE', division: 'CS_ADMIN' },
    creator: { id: -6, name: 'Creator Digital', username: 'creator', role: 'CREATOR_DIGITAL', division: 'CREATOR_DIGITAL' },
    'creator_digital': { id: -6, name: 'Creator Digital', username: 'creator_digital', role: 'CREATOR_DIGITAL', division: 'CREATOR_DIGITAL' },
    admin_cs: { id: -7, name: 'Admin CS', username: 'admin_cs', role: 'ADMIN_CS', division: 'CS_ADMIN' },
    troubleshoots: { id: -8, name: 'Troubleshoots User', username: 'troubleshoots', role: 'TROUBLESHOOTS', division: 'NOC_TROUBLESHOOTS' },
  } as const

  return demoUsers[normalized as keyof typeof demoUsers] ?? null
}

export async function POST(request: Request) {
  try {
    await ensureUserDivisionColumn().catch(() => {})
    if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEV_ADMIN === '1') {
      const userCount = await prisma.user.count().catch(() => 0)
      if (userCount === 0) {
        try {
          const hashed = await bcrypt.hash('123456', 10)
          await prisma.user.create({
            data: { name: 'Admin', username: 'admin', password: hashed, role: 'ADMIN' },
          })
        } catch {}
      }
    }

    const body = await request.json()
    
    // Validate input
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      await logSecurityEvent({
        action: 'LOGIN_FAILED',
        request,
        user: null,
        meta: { reason: 'invalid_input' },
      }).catch(() => {})
      return NextResponse.json(
        { message: 'Invalid input', errors: result.error.flatten() },
        { status: 400 }
      )
    }

    const { username, password, rememberMe } = result.data

    // Normalize username to lowercase for case-insensitive login
    const normalizedUsername = username.toLowerCase()

    // Local-only fallback login so demo role access still works when remote DB is unavailable.
    if (
      process.env.NODE_ENV !== 'production' &&
      password === '123456'
    ) {
      const sessionUser = getLocalDemoUser(normalizedUsername)
      if (sessionUser) {
        await login(sessionUser, rememberMe)
        await logSecurityEvent({
          action: 'LOGIN_SUCCESS',
          request,
          user: { id: sessionUser.id, username: sessionUser.username, role: sessionUser.role },
          meta: { localOnly: true, rememberMe: Boolean(rememberMe) },
        }).catch(() => {})
        return NextResponse.json({ ...sessionUser, localOnly: true })
      }
    }

    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    })

    const isPasswordValid = user ? await bcrypt.compare(password, user.password) : false
    if (!user || !isPasswordValid) {
      await logSecurityEvent({
        action: 'LOGIN_FAILED',
        request,
        user: null,
        meta: { username: normalizedUsername, reason: 'invalid_credentials' },
      }).catch(() => {})
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    }

    const sessionUser = { id: user.id, name: user.name, username: user.username, role: user.role, division: user.division ?? null }
    await login(sessionUser, rememberMe)
    await logSecurityEvent({
      action: 'LOGIN_SUCCESS',
      request,
      user: { id: sessionUser.id, username: sessionUser.username, role: sessionUser.role },
      meta: { rememberMe: Boolean(rememberMe) },
    }).catch(() => {})

    return NextResponse.json(sessionUser)
  } catch (error) {
    console.error('Login error:', error)
    if (process.env.NODE_ENV !== 'production') {
      const msg = String(error instanceof Error ? error.message : error)
      if (msg.includes('PrismaClientInitializationError')) {
        return NextResponse.json(
          { message: 'Database connection failed. Periksa DATABASE_URL / DIRECT_URL di .env' },
          { status: 500 }
        )
      }
    }
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
