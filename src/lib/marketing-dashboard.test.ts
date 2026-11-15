import assert from 'node:assert/strict'
import test from 'node:test'
import { rankActiveMarketingCustomers } from '@/lib/marketing-dashboard'

test('annual customer ranking includes only active marketers before applying top 15', () => {
  const rows = [
    { name: 'Inactive', total: 900, byMonth: [] },
    { name: 'Chalis', total: 40, byMonth: [] },
    { name: 'Dimas', total: 70, byMonth: [] },
    { name: 'Wahyu', total: 70, byMonth: [] },
  ]

  const ranked = rankActiveMarketingCustomers(rows, ['Dimas', 'Wahyu', 'Chalis'], 2)

  assert.deepEqual(ranked.map((row) => row.name), ['Dimas', 'Wahyu'])
})

test('annual customer ranking matches active names without case or whitespace differences', () => {
  const ranked = rankActiveMarketingCustomers(
    [
      { name: '  CHALIS ', total: 10, byMonth: [] },
      { name: 'Inactive', total: 100, byMonth: [] },
    ],
    ['Chalis']
  )

  assert.deepEqual(ranked.map((row) => row.name), ['  CHALIS '])
})
