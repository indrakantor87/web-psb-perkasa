import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKml, parseKml } from './kml'

test('KML import preserves point name and normal IconStyle metadata', () => {
  const parsed = parseKml(`
    <kml><Document>
      <Style id="redPin">
        <IconStyle>
          <color>ff7f00ff</color>
          <scale>1.1</scale>
          <Icon><href>http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png</href></Icon>
          <hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>
        </IconStyle>
      </Style>
      <StyleMap id="pin">
        <Pair><key>normal</key><styleUrl>#redPin</styleUrl></Pair>
        <Pair><key>highlight</key><styleUrl>#redPin</styleUrl></Pair>
      </StyleMap>
      <Placemark>
        <name>ODC &amp; POP</name>
        <styleUrl>#pin</styleUrl>
        <Point><coordinates>111.02,-6.75,0</coordinates></Point>
      </Placemark>
    </Document></kml>
  `)

  assert.equal(parsed.points.length, 1)
  assert.equal(parsed.points[0].name, 'ODC & POP')
  assert.deepEqual(parsed.points[0].iconStyle, {
    color: '#FF007F',
    href: 'http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png',
    scale: 1.1,
    hotSpot: { x: 20, y: 2, xunits: 'pixels', yunits: 'pixels' },
  })
})

test('KML export uses the Google Earth yellow stars icon for splice points', () => {
  const kml = generateKml({
    lines: [],
    points: [{ name: 'S2', latitude: -6.7, longitude: 111, color: '#ffff00' }],
  })

  assert.match(kml, /paddle\/ylw-stars\.png/)
  assert.match(kml, /hotSpot x="32" y="1" xunits="pixels" yunits="pixels"/)
  assert.doesNotMatch(kml, /shapes\/star\.png/)
})

test('KML export keeps the tinted generic star for non-yellow point styles', () => {
  const kml = generateKml({
    lines: [],
    points: [{ name: 'Other', latitude: -6.7, longitude: 111, color: '#ff0000' }],
  })

  assert.match(kml, /shapes\/star\.png/)
  assert.match(kml, /<color>FF0000FF<\/color>/)
})
