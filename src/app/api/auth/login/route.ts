import { prisma } from '@/lib/prisma'
import { login } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate input
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Invalid input', errors: result.error.flatten() },
        { status: 400 }
      )
    }

    const { username, password } = result.data

    // Normalize username to lowercase for case-insensitive login
    const normalizedUsername = username.toLowerCase()

    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    })

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Exclude password from session
    const { password: _, ...userWithoutPassword } = user
    await login(userWithoutPassword)

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
