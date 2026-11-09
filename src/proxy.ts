import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'
import { canAccessMenu, getDefaultPathForRole } from '@/lib/access'

const rateLimit = new Map<string, { count: number; lastReset: number }>()

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (/\.[^/]+$/.test(pathname)) {
    return NextResponse.next()
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  const limit = 100
  const windowMs = 60 * 1000

  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 0, lastReset: Date.now() })
  }

  const ipData = rateLimit.get(ip)

  if (ipData) {
    if (Date.now() - ipData.lastReset > windowMs) {
      ipData.count = 0
      ipData.lastReset = Date.now()
    }

    ipData.count++

    if (ipData.count > limit) {
      return new NextResponse('Too Many Requests', { status: 429 })
    }
  }

  const session = request.cookies.get('session')?.value

  let currentUser = null
  if (session) {
    try {
      const payload = await decrypt(session)
      currentUser = payload.user
    } catch {
      // invalid session
    }
  }

  const publicPaths = ['/login', '/api/auth/login']
  const isPublicPath = publicPaths.includes(pathname)

  if (!currentUser && !isPublicPath && !pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (currentUser && pathname === '/login') {
    return NextResponse.redirect(new URL(getDefaultPathForRole(currentUser.role), request.url))
  }

  if (currentUser) {
    if (pathname === '/' && !canAccessMenu(currentUser.role, 'dashboard')) {
      return NextResponse.redirect(new URL(getDefaultPathForRole(currentUser.role), request.url))
    }
  }

  const response = NextResponse.next()

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data:;"
  )
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}
