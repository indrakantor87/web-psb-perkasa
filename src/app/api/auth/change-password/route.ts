import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { changePasswordSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const result = changePasswordSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = result.data

    // Get user from database to get the current password hash
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
    })

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Password saat ini salah' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ message: 'Password berhasil diubah' })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengubah password' },
      { status: 500 }
    )
  }
}
