import assert from 'node:assert/strict'
import test from 'node:test'
import { parseGmReportDate, parseGmReportGrid } from './gm-daily-report'
import { canManageGmDailyReport, canReadGmDailyReport } from './gm-daily-report-access'

const reportHeader = [
  ['LAPORAN DATA PSB & ISOLIR BULAN NOVEMBER 2026'],
  [
    'TANGGAL',
    'TOTAL LIST PSB',
    'ANTRIAN PASANG',
    'TERPASANG',
    'TOTAL PELANGGAN RADBOX 24, 25 & 26',
    'TOTAL DATA ISOLIR',
    '',
    'TOTAL DISMANTLE',
    '',
    'PENURUNAN PELANGGAN',
    'TOTAL PELANGGAN AKTIF RADBOX 24, 25 & 26',
  ],
  ['', '', '', '', '', 'MASIH DILANJUTKAN', 'TIDAK DILANJUTKAN', 'OPEN', 'CLOSED'],
]

const reportMerges = [
  { s: { r: 1, c: 5 }, e: { r: 1, c: 6 } },
  { s: { r: 1, c: 7 }, e: { r: 1, c: 8 } },
]

test('imports reported active customers and decline percentage without recalculating them', () => {
  const result = parseGmReportGrid(
    [
      ...reportHeader,
      ['01/11/2026', 3, 3, 0, 371, 78, 237, 57, '', '8%', 326],
      ['02/11/2026', '', '', '', '', '', '', '', '', '', ''],
    ],
    reportMerges,
  )

  assert.deepEqual(result.errors, [])
  assert.equal(result.rows.length, 1)
  assert.deepEqual(result.rows[0], {
    reportDate: '2026-11-01',
    totalPsbList: 3,
    installationQueue: 3,
    installedToday: 0,
    totalCustomers: 371,
    activeCustomers: 326,
    isolationContinued: 78,
    isolationNotContinued: 237,
    dismantleOpen: 57,
    dismantleClosed: 0,
    customerDeclinePercent: 8,
  })
})

test('requires active-customer and decline values reported in the source workbook', () => {
  const result = parseGmReportGrid(
    [...reportHeader, ['01/11/2026', 3, 3, 0, 371, 78, 237, 57, 0, '', '']],
    reportMerges,
  )

  assert.equal(result.rows.length, 0)
  assert.match(result.errors[0], /pelanggan aktif, penurunan pelanggan/)
})

test('accepts the RADBOOX spelling used by the exported workbook headers', () => {
  const radbooxHeader = [
    reportHeader[0],
    ['TANGGAL', 'TOTAL LIST PSB', 'ANTRIAN PASANG', 'TERPASANG', 'TOTAL PELANGGAN (RADBOOX 24, 25 & 26)', 'TOTAL DATA ISOLIR', '', 'TOTAL DISMANTLE', '', 'PENURUNAN PELANGGAN', 'TOTAL PELANGGAN AKTIF (RADBOOX 24, 25 & 26)'],
    reportHeader[2],
  ]
  const result = parseGmReportGrid(
    [...radbooxHeader, ['01/11/2026', 3, 3, 0, 371, 78, 237, 57, '', '8%', 326]],
    reportMerges,
  )

  assert.deepEqual(result.errors, [])
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].totalCustomers, 371)
  assert.equal(result.rows[0].activeCustomers, 326)
})

test('parses ISO, Indonesian, Excel serial, and Date values as date keys', () => {
  assert.equal(parseGmReportDate('2026-11-01'), '2026-11-01')
  assert.equal(parseGmReportDate('01/11/2026'), '2026-11-01')
  assert.equal(parseGmReportDate(new Date(Date.UTC(2026, 10, 1))), '2026-11-01')
  assert.equal(parseGmReportDate(46327), '2026-11-01')
  assert.equal(parseGmReportDate('31/02/2026'), null)
})

test('GM can read reports while only administrators and developers can manage them', () => {
  assert.equal(canReadGmDailyReport('PRIORITY'), true)
  assert.equal(canManageGmDailyReport('PRIORITY'), false)
  assert.equal(canReadGmDailyReport('ADMIN'), true)
  assert.equal(canManageGmDailyReport('ADMIN'), true)
  assert.equal(canReadGmDailyReport('DEVELOPER'), true)
  assert.equal(canManageGmDailyReport('DEVELOPER'), true)
  assert.equal(canReadGmDailyReport('CS'), false)
  assert.equal(canManageGmDailyReport('CS'), false)
})
