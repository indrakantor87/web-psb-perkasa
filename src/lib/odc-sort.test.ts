import assert from 'node:assert/strict'
import test from 'node:test'
import { compareOdcRows } from '@/lib/odc-sort'

test('ODC master and name-derived rows sort together by ODC number', () => {
  const rows = [
    { nama_odc: 'ODC 14 (MRGYSO)' },
    { nama_odc: 'ODC 01 (MRGYSO)' },
    { nama_odc: 'ODC 2 (MRGYSO)' },
    { nama_odc: 'ODC 11 (MRGYSO)' },
    { nama_odc: 'ODP belum terpetakan dari nama' },
  ]

  assert.deepEqual(
    rows.sort(compareOdcRows).map((row) => row.nama_odc),
    [
      'ODC 01 (MRGYSO)',
      'ODC 2 (MRGYSO)',
      'ODC 11 (MRGYSO)',
      'ODC 14 (MRGYSO)',
      'ODP belum terpetakan dari nama',
    ],
  )
})
