import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

const rateLimit = new Map<string, { count: number; lastReset: number }>()

export async function middleware(request: NextRequest) {
  // Simple Rate Limiting (In-Memory)
  // Note: This is per-instance. For distributed environments (Vercel), 
  // this is not a strict global limit but helps mitigate spam.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  const limit = 100 // requests
  const windowMs = 60 * 1000 // 1 minute

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

  // Define paths that don't require authentication
  const publicPaths = ['/login', '/api/auth/login']
  const isPublicPath = publicPaths.includes(request.nextUrl.pathname)

  if (!currentUser && !isPublicPath && !request.nextUrl.pathname.startsWith('/_next') && !request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (currentUser && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Role-based access control
  if (currentUser) {
    // Block MARKETING from settings (all settings pages)
    if (currentUser.role === 'MARKETING') {
      if (request.nextUrl.pathname.startsWith('/settings')) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    // Block TEKNISI from input and settings
    if (currentUser.role === 'TEKNISI') {
      const restrictedPaths = ['/input', '/settings', '/marketing-activities', '/isolir']
      if (restrictedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    if ((currentUser.role || '').toUpperCase() === 'TROUBLESHOOTS') {
      if (request.nextUrl.pathname.startsWith('/api')) {
        return NextResponse.next()
      }

      if (request.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/trouble-ticket', request.url))
      }

      const allowedPaths = ['/trouble-ticket', '/profile']
      const isAllowed = allowedPaths.some((path) => request.nextUrl.pathname.startsWith(path))
      if (!isAllowed) {
        return NextResponse.redirect(new URL('/trouble-ticket', request.url))
      }
    }
  }

  const response = NextResponse.next()

  // Add Security Headers
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
