/**
 * Mengekstrak koordinat latitude & longitude dari berbagai format input,
 * termasuk link Google Maps (contoh: https://maps.google.com/?q=-6.5,111.0).
 *
 * Format yang didukung:
 * - `-6.548,111.047` (langsung)
 * - `@-6.548,111.047` (link share Google Maps)
 * - `?q=-6.548,111.047`
 * - `?ll=-6.548,111.047`
 *
 * Mengembalikan null jika tidak dapat mengekstrak koordinat yang valid.
 */
export function parseLatLng(input: string) {
  const s = String(input ?? '').trim()
  if (!s) return null

  const direct = s.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  const at = s.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const q = s.match(/[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const ll = s.match(/[?&]ll=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const m = direct ?? at ?? q ?? ll
  if (!m) return null

  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null

  const aIsLat = a >= -90 && a <= 90
  const bIsLat = b >= -90 && b <= 90
  const aIsLng = a >= -180 && a <= 180
  const bIsLng = b >= -180 && b <= 180

  let latitude: number
  let longitude: number
  if (aIsLat && bIsLng) {
    latitude = a
    longitude = b
  } else if (aIsLng && bIsLat) {
    latitude = b
    longitude = a
  } else {
    return null
  }
  return { latitude, longitude }
}

/**
 * Memformat koordinat menjadi string `lat, lng` dengan 6 digit desimal.
 */
export function formatLatLng(lat: number, lng: number) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}
