import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'
import { isAddressAccurate, parseLatLng } from '@/lib/geo'

export const runtime = 'nodejs'

/**
 * Mengekstrak alamat dari HTML halaman Google Maps.
 *
 * Google Maps menyimpan alamat di beberapa tempat:
 * - `<meta name="description">` (paling umum, berisi nama tempat + alamat)
 * - JSON-LD structured data
 * - `window.APP_INITIALIZATION_STATE` (data inisialisasi)
 */
function extractAddressFromGoogleMapsHtml(html: string): string | null {
  if (!html) return null

  // 1. Coba dari <meta name="description">
  const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
  if (metaDesc) {
    const content = metaDesc[1].trim()
    // Meta description biasanya format: "Nama Tempat · Alamat" atau "Nama Tempat, Alamat"
    // Bersihkan entity HTML
    const decoded = content
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;amp;/g, '&')
    if (decoded && decoded.length > 10) {
      return decoded
    }
  }

  // 2. Coba dari JSON-LD (application/ld+json)
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)
  if (jsonLdMatch) {
    try {
      const json = JSON.parse(jsonLdMatch[1])
      const address = json?.address
      if (address) {
        if (typeof address === 'string' && address.length > 10) return address
        if (typeof address === 'object') {
          const parts = [
            address.streetAddress,
            address.addressLocality,
            address.addressRegion,
            address.postalCode,
            address.addressCountry,
          ].filter(Boolean)
          if (parts.length) return parts.join(', ')
        }
      }
    } catch {
      // ignore parse error
    }
  }

  return null
}

/**
 * Reverse geocoding via Nominatim (OpenStreetMap). Gratis tanpa API key.
 * Fallback jika scraping Google Maps tidak mendapatkan alamat.
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

    const display = String(data?.display_name ?? '').trim()
    if (!display) return null

    if (!isAddressAccurate(display)) return null

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
  let googleMapsHtml = ''

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
      }

      // Simpan HTML untuk ekstraksi alamat dari Google Maps.
      googleMapsHtml = await res.text().catch(() => '')

      if (!latitude) {
        // Fallback: coba ekstrak koordinat dari body.
        const fromBody = googleMapsHtml.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
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

  if (withAddress) {
    // Prioritas 1: ambil alamat dari HTML halaman Google Maps (paling akurat).
    let address = extractAddressFromGoogleMapsHtml(googleMapsHtml)

    // Prioritas 2: jika dari HTML tidak ada atau kurang akurat, coba Nominatim.
    if (!address || !isAddressAccurate(address)) {
      const nominatimAddr = await reverseGeocode(latitude, longitude)
      if (nominatimAddr) address = nominatimAddr
    }

    result.address = address || null
  }

  return NextResponse.json(result)
}
