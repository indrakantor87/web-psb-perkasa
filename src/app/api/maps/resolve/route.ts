import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function parseLatLngFromString(input: string) {
  const s = String(input ?? '').trim()
  if (!s) return null

  const direct = s.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  const at = s.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const q = s.match(/[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const ll = s.match(/[?&]ll=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const query = s.match(/[?&]query=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const data3d4d = s.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
  const m = direct ?? at ?? q ?? ll ?? query ?? data3d4d
  if (!m) return null

  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null

  const aIsLat = a >= -90 && a <= 90
  const bIsLat = b >= -90 && b <= 90
  const aIsLng = a >= -180 && a <= 180
  const bIsLng = b >= -180 && b <= 180

  if (aIsLat && bIsLng) return { latitude: a, longitude: b }
  if (aIsLng && bIsLat) return { latitude: b, longitude: a }
  return null
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: unknown }
  const urlStr = String(body.url ?? '').trim()
  if (!urlStr) return NextResponse.json({ error: 'URL kosong' }, { status: 400 })

  try {
    const inputParsed = parseLatLngFromString(urlStr)
    if (inputParsed) return NextResponse.json({ ...inputParsed, resolvedUrl: urlStr })

    let targetUrl = urlStr
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`

    const resp = await fetch(targetUrl, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    const resolvedUrl = resp.url || targetUrl
    const parsed = parseLatLngFromString(resolvedUrl)
    if (parsed) return NextResponse.json({ ...parsed, resolvedUrl })

    const html = await resp.text().catch(() => '')
    const htmlParsed = parseLatLngFromString(html)
    if (htmlParsed) return NextResponse.json({ ...htmlParsed, resolvedUrl })

    return NextResponse.json({ error: 'Koordinat tidak ditemukan dari link' }, { status: 400 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message || 'Gagal resolve link' }, { status: 500 })
  }
}
