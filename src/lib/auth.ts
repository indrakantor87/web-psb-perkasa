import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

let cachedKey: Uint8Array | null = null
const encoder = new TextEncoder()

function getJwtKey() {
  if (cachedKey) return cachedKey

  const envSecret = String(process.env.JWT_SECRET_KEY ?? '').trim()
  if (!envSecret) {
    if (process.env.NODE_ENV === 'production') {
      cachedKey = encoder.encode('p3rk4s4_W3b_PSB_JWT_S3cr3t_K3y_2026_Production_Safe')
      return cachedKey
    }
    cachedKey = encoder.encode('rahasia-perkasa-networks-2026')
    return cachedKey
  }

  cachedKey = encoder.encode(envSecret)
  return cachedKey
}

export type SessionUser = {
  id: number
  name: string
  username: string
  role: string
  division?: string | null
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
    .sign(getJwtKey())
}

export async function decrypt(input: string): Promise<SessionData> {
  const { payload } = await jwtVerify(input, getJwtKey(), {
    algorithms: ['HS256'],
  })
  return payload as unknown as SessionData
}

export async function login(userData: SessionUser, rememberMe: boolean = false) {
  const expiresIn = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const expires = new Date(Date.now() + expiresIn)
  
  const session = await encrypt({ user: userData, expires: expires.toISOString(), rememberMe }, rememberMe ? '30d' : '24h')

  const cookieStore = await cookies()
  cookieStore.set('session', session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.set('session', '', {
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
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

  const parsed = await decrypt(session)
  
  const expiresIn = parsed.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  parsed.expires = new Date(Date.now() + expiresIn).toISOString()
  
  const res = NextResponse.next()
  res.cookies.set({
    name: 'session',
    value: await encrypt(parsed, parsed.rememberMe ? '30d' : '24h'),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(parsed.expires),
  })
  return res
}
