import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKml } from './kml'

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
