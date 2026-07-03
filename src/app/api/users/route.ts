import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { userCreateSchema, userUpdateSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { cache } from '@/lib/cache'
import { ensureUserDivisionColumn } from '@/lib/db-init'

type UserWithOptionalDivision = {
  division?: string | null
}

function mapRoleToDivision(role: string) {
  const roleUpper = String(role ?? '').trim().toUpperCase()
  if (roleUpper === 'MARKETING') return 'PENJUALAN'
  if (roleUpper === 'CS' || roleUpper === 'ADMIN_CS' || roleUpper === 'DISMANTLE') return 'CS_ADMIN'
  if (roleUpper === 'NOC' || roleUpper === 'TROUBLESHOOTS' || roleUpper === 'TEKNISI') return 'NOC_TROUBLESHOOTS'
  if (roleUpper === 'CREATOR_DIGITAL') return 'CREATOR_DIGITAL'
  return null
}

function readUserDivision(user: UserWithOptionalDivision) {
  return user.division ?? null
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Restrict to ADMIN only
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await ensureUserDivisionColumn().catch(() => {})
    const body = await request.json()

    // Validate input
    const result = userCreateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: result.error.issues },
        { status: 400 }
      )
    }

    const { name, username, password, role } = result.data
    const division = mapRoleToDivision(role)

    const normalizedUsername = username.toLowerCase().replace(/\s+/g, '')

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    async function repairUserIdSequence() {
      await prisma.$executeRaw`
        SELECT setval(
          pg_get_serial_sequence('"User"', 'id'),
          COALESCE((SELECT MAX(id) FROM "User"), 0) + 1,
          false
        );
      `
    }
    function isUserIdUniqueError(e: unknown) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false
      if (e.code !== 'P2002') return false
      const meta = e.meta as { target?: unknown } | undefined
      const target = meta?.target
      if (Array.isArray(target)) return target.includes('id')
      return target === 'id'
    }

    const createData = {
      name,
      username: normalizedUsername,
      password: hashedPassword,
      role,
      division,
    } as Prisma.UserUncheckedCreateInput & UserWithOptionalDivision

    let newUser
    try {
      newUser = await prisma.user.create({
        data: createData as Prisma.UserUncheckedCreateInput,
      })
    } catch (e) {
      if (!isUserIdUniqueError(e)) throw e
      await repairUserIdSequence()
      newUser = await prisma.user.create({
        data: createData as Prisma.UserUncheckedCreateInput,
      })
    }
    const safeUser = {
      id: newUser.id,
      name: newUser.name,
      username: newUser.username,
      role: newUser.role,
      division: readUserDivision(newUser as UserWithOptionalDivision),
      createdAt: newUser.createdAt,
    }
    cache.invalidateByPrefix('users:')
    return NextResponse.json(safeUser)
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ 
      error: 'Failed to create user: ' + (error instanceof Error ? error.message : String(error)) 
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Restrict to ADMIN, CS, NOC
  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await ensureUserDivisionColumn().catch(() => {})
    const { searchParams } = new URL(request.url)
    const roleParam = String(searchParams.get('role') ?? '').trim().toUpperCase()
    const where = roleParam ? { role: roleParam } : undefined
    const users = await prisma.user.findMany({
      where,
      orderBy: roleParam ? { name: 'asc' } : { createdAt: 'desc' },
    })

    const safeUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      division: readUserDivision(user as UserWithOptionalDivision),
      createdAt: user.createdAt,
    }))

    return NextResponse.json(safeUsers)
  } catch (error) {
    console.error('Fetch users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Restrict to ADMIN only
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Validate input
    const result = userUpdateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: result.error.issues },
        { status: 400 }
      )
    }

    const { id, password } = result.data

    const hashedPassword = await bcrypt.hash(password, 10)

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    })
    const safeUser = { id: updatedUser.id, name: updatedUser.name, username: updatedUser.username, role: updatedUser.role, createdAt: updatedUser.createdAt }
    cache.invalidateByPrefix('users:')
    return NextResponse.json(safeUser)
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Restrict to ADMIN only
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id: Number(id) },
    })
    cache.invalidateByPrefix('users:')
    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
