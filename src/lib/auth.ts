import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const SECRET_KEY = process.env.JWT_SECRET_KEY || 'rahasia-perkasa-networks-2026'
const key = new TextEncoder().encode(SECRET_KEY)

export type SessionUser = {
  id: number
  name: string
  username: string
  role: string
}

export type SessionData = {
  user: SessionUser
  expires: string
  rememberMe?: boolean
}

export async function encrypt(payload: Record<string, unknown>, expiresIn: string = '24h') {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key)
}

export async function decrypt(input: string): Promise<SessionData> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  })
  return payload as unknown as SessionData
}

export async function login(userData: SessionUser, rememberMe: boolean = false) {
  // Determine expiration based on rememberMe
  // Default: 24 hours, Remember Me: 30 days
  const expiresIn = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const expires = new Date(Date.now() + expiresIn)
  
  // Create the session
  const session = await encrypt({ user: userData, expires: expires.toISOString(), rememberMe }, rememberMe ? '30d' : '24h')

  // Save the session in a cookie
  const cookieStore = await cookies()
  cookieStore.set('session', session, { expires, httpOnly: true })
}

export async function logout() {
  // Destroy the session
  const cookieStore = await cookies()
  cookieStore.set('session', '', { expires: new Date(0) })
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null
  try {
    return await decrypt(session)
  } catch {
    return null
  }
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get('session')?.value
  if (!session) return

  // Refresh the session so it doesn't expire
  const parsed = await decrypt(session)
  
  const expiresIn = parsed.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  parsed.expires = new Date(Date.now() + expiresIn).toISOString()
  
  const res = NextResponse.next()
  res.cookies.set({
    name: 'session',
    value: await encrypt(parsed, parsed.rememberMe ? '30d' : '24h'),
    httpOnly: true,
    expires: new Date(parsed.expires),
  })
  return res
}
