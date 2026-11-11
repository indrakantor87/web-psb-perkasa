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
 * - `<meta property="og:description">`
 * - JSON-LD structured data
 * - `window.APP_INITIALIZATION_STATE` (data inisialisasi berisi array alamat)
 */
function extractAddressFromGoogleMapsHtml(html: string): string | null {
  if (!html) return null

  const decodeEntities = (s: string) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;amp;/g, '&')

  // 1. Coba dari <meta name="description">
  const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
  if (metaDesc) {
    const decoded = decodeEntities(metaDesc[1].trim())
    if (decoded && decoded.length > 15) return decoded
  }

  // 2. Coba dari <meta property="og:description">
  const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
  if (ogDesc) {
    const decoded = decodeEntities(ogDesc[1].trim())
    if (decoded && decoded.length > 15) return decoded
  }

  // 3. Coba dari JSON-LD (application/ld+json)
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)
  if (jsonLdMatch) {
    try {
      const json = JSON.parse(jsonLdMatch[1])
      const address = json?.address
      if (address) {
        if (typeof address === 'string' && address.length > 15) return address
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

  // 4. Coba dari window.APP_INITIALIZATION_STATE (alamat ada di array string)
  // Format: ...,"Alamat lengkap di sini",...
  const appStateMatch = html.match(/window\.APP_INITIALIZATION_STATE\s*=\s*(\[\[[\s\S]*?\]\]);/)
  if (appStateMatch) {
    try {
      const state = JSON.parse(appStateMatch[1])
      // Cari string yang mirip alamat (mengandung koma dan panjang)
      const findAddress = (arr: unknown[]): string | null => {
        for (const item of arr) {
          if (typeof item === 'string') {
            if (item.length > 20 && item.includes(',') && !item.startsWith('http')) {
              return item
            }
          } else if (Array.isArray(item)) {
            const found = findAddress(item)
            if (found) return found
          }
        }
        return null
      }
      const found = findAddress(state)
      if (found) return decodeEntities(found)
    } catch {
      // ignore
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

    // Hanya Nominatim yang perlu filter akurasi.
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
    // Jika koordinat di-parse langsung (bukan dari short link), HTML Google Maps
    // belum di-fetch. Ambil halaman Google Maps untuk koordinat tersebut agar
    // alamat bisa diekstrak dari HTML (lebih akurat daripada Nominatim).
    if (!googleMapsHtml) {
      try {
        const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)

        const res = await fetch(gmapsUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        })
        clearTimeout(timeout)

        googleMapsHtml = await res.text().catch(() => '')
      } catch {
        // abaikan, fallback ke Nominatim
      }
    }

    // Prioritas 1: ambil alamat dari HTML halaman Google Maps (paling akurat).
    // Alamat dari Google Maps tidak perlu filter akurasi karena sudah terverifikasi.
    let address = extractAddressFromGoogleMapsHtml(googleMapsHtml)

    // Prioritas 2: jika dari HTML tidak ada, coba Nominatim (dengan filter akurasi).
    if (!address) {
      address = await reverseGeocode(latitude, longitude)
    }

    result.address = address || null
  }

  return NextResponse.json(result)
}
