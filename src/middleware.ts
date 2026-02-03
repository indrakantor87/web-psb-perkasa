import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

const rateLimit = new Map<string, { count: number; lastReset: number }>()

export async function middleware(request: NextRequest) {
  // Simple Rate Limiting (In-Memory)
  // Note: This is per-instance. For distributed environments (Vercel), 
  // this is not a strict global limit but helps mitigate spam.
  const ip = request.ip || '127.0.0.1'
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
    } catch (e) {
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
  if (currentUser && currentUser.role === 'MARKETING') {
    const restrictedPaths = ['/settings/priorities', '/settings/users']
    if (restrictedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
      return NextResponse.redirect(new URL('/', request.url))
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
