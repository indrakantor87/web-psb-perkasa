import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'
import { isAddressAccurate } from '@/lib/geo'

export const runtime = 'nodejs'

/**
 * Endpoint reverse geocoding: mengubah koordinat lat/lng menjadi alamat
 * menggunakan Nominatim (OpenStreetMap). Gratis tanpa API key.
 *
 * Mengembalikan `address: null` jika hasilnya dianggap kurang akurat,
 * agar field alamat dibiarkan kosong untuk diisi manual oleh user.
 */
export async function GET(req: Request) {
  const session = await getSession().catch(() => null)
  const accessError = ensureMenuAccess(session, 'odp')
  if (accessError) return accessError

  const url = new URL(req.url)
  const latStr = url.searchParams.get('lat') ?? ''
  const lngStr = url.searchParams.get('lng') ?? ''

  const lat = Number(latStr)
  const lng = Number(lngStr)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Parameter lat dan lng wajib berupa angka' }, { status: 400 })
  }

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

    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal mengambil alamat dari Nominatim' }, { status: res.status })
    }

    const data = await res.json()
    const display = String(data?.display_name ?? '').trim()

    if (!display || !isAddressAccurate(display)) {
      return NextResponse.json({ address: null, accurate: false })
    }

    return NextResponse.json({ address: display, accurate: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Gagal reverse geocoding: ${message}` }, { status: 500 })
  }
}
