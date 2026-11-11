import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'
import { parseLatLng } from '@/lib/geo'

export const runtime = 'nodejs'

/**
 * Endpoint untuk menyelesaikan (resolve) short link Google Maps menjadi
 * koordinat latitude & longitude.
 *
 * Short link seperti https://maps.app.goo.gl/XXXX tidak mengandung koordinat
 * secara langsung, melainkan redirect ke URL lengkap yang berisi lat/lng.
 * Endpoint ini mengikuti redirect tersebut dan mengekstrak koordinatnya.
 */
export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuAccess(session, 'odp')
  if (accessError) return accessError

  const url = new URL(req.url)
  const target = (url.searchParams.get('url') ?? '').trim()

  if (!target) {
    return NextResponse.json({ error: 'Parameter url wajib diisi' }, { status: 400 })
  }

  // Coba parsing langsung dulu (untuk URL yang sudah berisi koordinat).
  const direct = parseLatLng(target)
  if (direct) {
    return NextResponse.json({ latitude: direct.latitude, longitude: direct.longitude, source: 'direct' })
  }

  // Jika tidak bisa langsung, ikuti redirect untuk short link Google Maps.
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    clearTimeout(timeout)

    const finalUrl = res.url || target
    const parsed = parseLatLng(finalUrl)

    if (parsed) {
      return NextResponse.json({ latitude: parsed.latitude, longitude: parsed.longitude, source: 'redirect', finalUrl })
    }

    // Fallback: coba ekstrak dari body respons (kadang koordinat ada di meta tag).
    const text = await res.text().catch(() => '')
    const fromBody = text.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
    if (fromBody) {
      return NextResponse.json({
        latitude: Number(fromBody[1]),
        longitude: Number(fromBody[2]),
        source: 'body',
      })
    }

    return NextResponse.json({ error: 'Koordinat tidak ditemukan dari URL tersebut' }, { status: 404 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Gagal menyelesaikan URL: ${message}` }, { status: 500 })
  }
}
