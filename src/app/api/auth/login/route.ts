import { prisma } from '@/lib/prisma'
import { login } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validations'
import { ensureUserDivisionColumn } from '@/lib/db-init'

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
      return NextResponse.json(
        { message: 'Invalid input', errors: result.error.flatten() },
        { status: 400 }
      )
    }

    const { username, password, rememberMe } = result.data

    // Normalize username to lowercase for case-insensitive login
    const normalizedUsername = username.toLowerCase()

    // Local-only fallback login so app access still works when remote DB is unavailable.
    if (
      process.env.NODE_ENV !== 'production' &&
      normalizedUsername === 'admin' &&
      password === '123456'
    ) {
      const sessionUser = {
        id: 0,
        name: 'Admin',
        username: 'admin',
        role: 'ADMIN',
        division: null,
      }
      await login(sessionUser, rememberMe)
      return NextResponse.json({ ...sessionUser, localOnly: true })
    }

    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    })

    const isPasswordValid = user ? await bcrypt.compare(password, user.password) : false
    if (!user || !isPasswordValid) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    }

    const sessionUser = { id: user.id, name: user.name, username: user.username, role: user.role, division: user.division ?? null }
    await login(sessionUser, rememberMe)

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
