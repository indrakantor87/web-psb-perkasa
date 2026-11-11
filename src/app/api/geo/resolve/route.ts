import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'
import { isAddressAccurate, parseLatLng } from '@/lib/geo'

export const runtime = 'nodejs'

/**
 * Endpoint untuk menyelesaikan (resolve) short link Google Maps menjadi
 * koordinat latitude & longitude, lalu melakukan reverse geocoding via
 * Nominatim (OpenStreetMap) untuk mendapatkan alamat.
 *
 * Short link seperti https://maps.app.goo.gl/XXXX tidak mengandung koordinat
 * secara langsung, melainkan redirect ke URL lengkap yang berisi lat/lng.
 * Endpoint ini mengikuti redirect tersebut dan mengekstrak koordinatnya.
 */

/**
 * Reverse geocoding via Nominatim (OpenStreetMap). Gratis tanpa API key.
 * Mengembalikan alamat terformat atau null jika gagal.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id&zoom=18&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'web-psb-perkasa/1.0 (geocoding)',
        },
      },
    )
    clearTimeout(timeout)

    if (!res.ok) return null
    const data = await res.json()

    // Nominatim menyediakan display_name (alamat lengkap) dan address (terstruktur).
    const display = String(data?.display_name ?? '').trim()
    if (!display) return null

    // Hanya kembalikan alamat jika dianggap cukup akurat.
    if (!isAddressAccurate(display)) return null

    // Gunakan display_name yang sudah berupa alamat lengkap.
    return display
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuAccess(session, 'odp')
  if (accessError) return accessError

  const url = new URL(req.url)
  const target = (url.searchParams.get('url') ?? '').trim()
  const withAddress = url.searchParams.get('address') === '1'

  if (!target) {
    return NextResponse.json({ error: 'Parameter url wajib diisi' }, { status: 400 })
  }

  let latitude: number | null = null
  let longitude: number | null = null
  let source = ''

  // Coba parsing langsung dulu (untuk URL yang sudah berisi koordinat).
  const direct = parseLatLng(target)
  if (direct) {
    latitude = direct.latitude
    longitude = direct.longitude
    source = 'direct'
  }

  // Jika tidak bisa langsung, ikuti redirect untuk short link Google Maps.
  if (!latitude) {
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
        latitude = parsed.latitude
        longitude = parsed.longitude
        source = 'redirect'
      } else {
        // Fallback: coba ekstrak dari body respons (kadang koordinat ada di meta tag).
        const text = await res.text().catch(() => '')
        const fromBody = text.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
        if (fromBody) {
          latitude = Number(fromBody[1])
          longitude = Number(fromBody[2])
          source = 'body'
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: `Gagal menyelesaikan URL: ${message}` }, { status: 500 })
    }
  }

  if (!latitude || !longitude) {
    return NextResponse.json({ error: 'Koordinat tidak ditemukan dari URL tersebut' }, { status: 404 })
  }

  const result: { latitude: number; longitude: number; source: string; address?: string | null } = {
    latitude,
    longitude,
    source,
  }

  // Reverse geocoding opsional via Nominatim.
  if (withAddress) {
    result.address = await reverseGeocode(latitude, longitude)
  }

  return NextResponse.json(result)
}
