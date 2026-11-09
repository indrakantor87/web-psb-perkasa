import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canAccessMenu, normalizeRole } from '@/lib/access'
import { isMarketingOwnerMatch } from '@/lib/marketing-users'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  if (!canAccessMenu(session.user.role, 'list')) return new NextResponse('Forbidden', { status: 403 })

  try {
    const { id } = await params
    
    const ticket = await prisma.ticket.findUnique({
      where: { id: parseInt(id) },
      select: { fotoRumah: true, marketingName: true }
    })

    if (!ticket || !ticket.fotoRumah) {
      return new NextResponse('Not found', { status: 404 })
    }
    if (normalizeRole(session.user.role) === 'MARKETING') {
      if (!isMarketingOwnerMatch(ticket.marketingName, session.user.name)) {
        return new NextResponse('Not found', { status: 404 })
      }
    }

    // Check if it's a data URI
    const matches = ticket.fotoRumah.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    
    if (matches && matches.length === 3) {
      const type = matches[1]
      const buffer = Buffer.from(matches[2], 'base64')
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': type,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'private, no-store',
        }
      })
    }

    // Fallback/Error
    return new NextResponse('Invalid image data', { status: 500 })
  } catch (error) {
    console.error('Error serving photo:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
