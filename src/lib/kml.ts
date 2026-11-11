/**
 * Helper untuk parse & generate file KML/KMZ (Google Earth).
 *
 * Format warna KML: AABBGGRR (8 hex digit).
 * - AA = alpha (transparansi)
 * - BB = biru
 * - GG = hijau
 * - RR = merah
 *
 * Di web kita pakai format hex CSS biasa (#RRGGBB).
 */

export type KmlPoint = {
  name: string
  description: string
  latitude: number
  longitude: number
  color?: string // hex CSS (#RRGGBB) dari IconStyle
}

export type KmlLine = {
  name: string
  description: string
  coordinates: { latitude: number; longitude: number }[]
  color?: string // hex CSS (#RRGGBB) dari LineStyle
}

export type KmlParseResult = {
  points: KmlPoint[]
  lines: KmlLine[]
}

/**
 * Konversi warna KML (AABBGGRR) ke hex CSS (#RRGGBB).
 */
export function kmlColorToCss(kmlColor: string): string {
  const clean = kmlColor.replace(/^#/, '').trim()
  if (clean.length === 8) {
    // AABBGGRR -> RRGGBB
    const rr = clean.slice(6, 8)
    const gg = clean.slice(4, 6)
    const bb = clean.slice(2, 4)
    return `#${rr}${gg}${bb}`.toUpperCase()
  }
  if (clean.length === 6) {
    return `#${clean}`.toUpperCase()
  }
  return `#${clean}`.toUpperCase()
}

/**
 * Konversi hex CSS (#RRGGBB) ke warna KML (AABBGGRR) dengan alpha penuh (FF).
 */
export function cssColorToKml(cssColor: string): string {
  const clean = cssColor.replace(/^#/, '').trim()
  let rr = '00'
  let gg = '00'
  let bb = '00'
  if (clean.length === 6) {
    rr = clean.slice(0, 2)
    gg = clean.slice(2, 4)
    bb = clean.slice(4, 6)
  } else if (clean.length === 8) {
    rr = clean.slice(0, 2)
    gg = clean.slice(2, 4)
    bb = clean.slice(4, 6)
  }
  // AABBGGRR, alpha FF (tidak transparan)
  return `FF${bb}${gg}${rr}`.toUpperCase()
}

/**
 * Parse string koordinat KML ("lng,lat,alt lng,lat,alt ...") menjadi array {lat,lng}.
 */
function parseKmlCoordinates(raw: string): { latitude: number; longitude: number }[] {
  return raw
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const parts = tuple.split(',')
      if (parts.length < 2) return null
      const lng = parseFloat(parts[0])
      const lat = parseFloat(parts[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { latitude: lat, longitude: lng }
    })
    .filter((p): p is { latitude: number; longitude: number } => p !== null)
}

/**
 * Parse isi KML menjadi daftar point (marker) dan line (polyline).
 * Menangani <Style> dengan LineStyle & IconStyle.
 */
export function parseKml(kml: string): KmlParseResult {
  const result: KmlParseResult = { points: [], lines: [] }

  // Parse style map: styleId -> {lineColor, iconColor}
  const styles = new Map<string, { lineColor?: string; iconColor?: string }>()
  const styleRegex = /<Style\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/Style>/gi
  let styleMatch: RegExpExecArray | null
  while ((styleMatch = styleRegex.exec(kml)) !== null) {
    const id = styleMatch[1]
    const body = styleMatch[2]
    const style: { lineColor?: string; iconColor?: string } = {}

    const lineColorMatch = body.match(/<LineStyle>[\s\S]*?<color>([^<]+)<\/color>[\s\S]*?<\/LineStyle>/i)
    if (lineColorMatch) style.lineColor = kmlColorToCss(lineColorMatch[1])

    const iconColorMatch = body.match(/<IconStyle>[\s\S]*?<color>([^<]+)<\/color>[\s\S]*?<\/IconStyle>/i)
    if (iconColorMatch) style.iconColor = kmlColorToCss(iconColorMatch[1])

    styles.set(id, style)
  }

  // Parse StyleMap (Google Earth sering pakai StyleMap dengan normal/highlight)
  const styleMapRegex = /<StyleMap\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/StyleMap>/gi
  let smMatch: RegExpExecArray | null
  while ((smMatch = styleMapRegex.exec(kml)) !== null) {
    const id = smMatch[1]
    const body = smMatch[2]
    const normalMatch = body.match(/<Pair>[\s\S]*?<key>normal<\/key>[\s\S]*?<styleUrl>#([^<]+)<\/styleUrl>[\s\S]*?<\/Pair>/i)
    if (normalMatch) {
      const ref = styles.get(normalMatch[1])
      if (ref) styles.set(id, ref)
    }
  }

  // Parse Placemark
  const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi
  let pmMatch: RegExpExecArray | null
  while ((pmMatch = placemarkRegex.exec(kml)) !== null) {
    const body = pmMatch[1]
    const name = (body.match(/<name>([\s\S]*?)<\/name>/i)?.[1] ?? '').trim()
    const description = (body.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? '').trim()

    // Resolve style: bisa inline <Style> atau <styleUrl>#id>
    let lineColor: string | undefined
    let iconColor: string | undefined

    const styleUrlMatch = body.match(/<styleUrl>#([^<]+)<\/styleUrl>/i)
    if (styleUrlMatch) {
      const style = styles.get(styleUrlMatch[1])
      if (style) {
        lineColor = style.lineColor
        iconColor = style.iconColor
      }
    }

    const inlineStyleMatch = body.match(/<Style[^>]*>([\s\S]*?)<\/Style>/i)
    if (inlineStyleMatch) {
      const inlineBody = inlineStyleMatch[1]
      const lc = inlineBody.match(/<LineStyle>[\s\S]*?<color>([^<]+)<\/color>[\s\S]*?<\/LineStyle>/i)
      if (lc) lineColor = kmlColorToCss(lc[1])
      const ic = inlineBody.match(/<IconStyle>[\s\S]*?<color>([^<]+)<\/color>[\s\S]*?<\/IconStyle>/i)
      if (ic) iconColor = kmlColorToCss(ic[1])
    }

    // LineString
    const lineStringMatch = body.match(/<LineString[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/i)
    if (lineStringMatch) {
      const coordinates = parseKmlCoordinates(lineStringMatch[1])
      if (coordinates.length >= 2) {
        result.lines.push({
          name,
          description,
          coordinates,
          color: lineColor,
        })
      }
      continue
    }

    // Point
    const pointMatch = body.match(/<Point[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/i)
    if (pointMatch) {
      const coordinates = parseKmlCoordinates(pointMatch[1])
      if (coordinates.length >= 1) {
        result.points.push({
          name,
          description,
          latitude: coordinates[0].latitude,
          longitude: coordinates[0].longitude,
          color: iconColor,
        })
      }
    }
  }

  return result
}

/**
 * Generate string KML dari daftar jalur (lines) dan splice (points).
 * Warna & nama sesuai data, sehingga hasilnya identik saat dibuka di Google Earth.
 */
export function generateKml(data: {
  lines: { name: string; description?: string; color?: string; coordinates: { latitude: number; longitude: number }[] }[]
  points: { name: string; description?: string; color?: string; latitude: number; longitude: number }[]
}): string {
  const now = new Date().toISOString()

  const lineStyles = new Map<string, string>()
  const pointStyles = new Map<string, string>()

  // Buat style unik per warna
  data.lines.forEach((l) => {
    const color = l.color || '#00ffff'
    if (!lineStyles.has(color)) lineStyles.set(color, `lineStyle${lineStyles.size}`)
  })
  data.points.forEach((p) => {
    const color = p.color || '#ffff00'
    if (!pointStyles.has(color)) pointStyles.set(color, `pointStyle${pointStyles.size}`)
  })

  let stylesXml = ''
  lineStyles.forEach((styleId, color) => {
    stylesXml += `
    <Style id="${styleId}">
      <LineStyle>
        <color>${cssColorToKml(color)}</color>
        <width>3</width>
      </LineStyle>
    </Style>`
  })
  pointStyles.forEach((styleId, color) => {
    stylesXml += `
    <Style id="${styleId}">
      <IconStyle>
        <color>${cssColorToKml(color)}</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>`
  })

  let placemarksXml = ''
  data.lines.forEach((l) => {
    const color = l.color || '#00ffff'
    const styleId = lineStyles.get(color)
    const coords = l.coordinates.map((c) => `${c.longitude},${c.latitude},0`).join(' ')
    placemarksXml += `
    <Placemark>
      <name>${escapeXml(l.name)}</name>
      <description>${escapeXml(l.description || '')}</description>
      <styleUrl>#${styleId}</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>`
  })

  data.points.forEach((p) => {
    const color = p.color || '#ffff00'
    const styleId = pointStyles.get(color)
    placemarksXml += `
    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description>${escapeXml(p.description || '')}</description>
      <styleUrl>#${styleId}</styleUrl>
      <Point>
        <coordinates>${p.longitude},${p.latitude},0</coordinates>
      </Point>
    </Placemark>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Jaringan Perkasa Networks</name>
    <description>Di-export dari Web PSB Perkasa pada ${now}</description>
    ${stylesXml}
    ${placemarksXml}
  </Document>
</kml>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
