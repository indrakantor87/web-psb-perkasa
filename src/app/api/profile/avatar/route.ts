import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const action = String(formData.get('action') ?? '').trim()

    if (action === 'remove') {
      try {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { avatar: null },
        })
      } catch {
        return NextResponse.json(
          { error: 'Kolom avatar belum ada di database. Jalankan ALTER TABLE "User" ADD COLUMN "avatar" TEXT;' },
          { status: 500 }
        )
      }
      return NextResponse.redirect('/profile', 303)
    }

    const file = formData.get('avatar') as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipe file tidak didukung' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File terlalu besar (maks 2MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const avatar = `data:${file.type};base64,${buffer.toString('base64')}`

    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { avatar },
      })
    } catch {
      return NextResponse.json(
        { error: 'Kolom avatar belum ada di database. Jalankan ALTER TABLE "User" ADD COLUMN "avatar" TEXT;' },
        { status: 500 }
      )
    }

    return NextResponse.redirect('/profile', 303)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || 'Gagal upload avatar' }, { status: 500 })
  }
}
