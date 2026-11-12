import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getGmDashboardPeriodLabel,
  getGmDashboardQueryRange,
  getGmDashboardPeriodRange,
  resolveGmDashboardPeriod,
} from './gm-dashboard-period'

test('resolves a selected month and year', () => {
  const period = resolveGmDashboardPeriod(new URLSearchParams('year=2024&month=2'))
  assert.deepEqual(period, { year: 2024, month: 2 })
  assert.equal(getGmDashboardPeriodLabel(period.year, period.month), 'Februari 2024')
})

test('defaults invalid or missing values to the current Jakarta month', () => {
  const now = new Date('2026-11-12T18:00:00.000Z')
  const period = resolveGmDashboardPeriod(new URLSearchParams('year=bad&month='), now)
  assert.deepEqual(period, { year: 2026, month: 11 })
})

test('clamps month and year to supported bounds', () => {
  assert.deepEqual(
    resolveGmDashboardPeriod(new URLSearchParams('year=1900&month=13')),
    { year: 2020, month: 12 }
  )
})

test('uses Jakarta month boundaries including leap-year February', () => {
  const { start, end } = getGmDashboardPeriodRange(2024, 2)
  assert.equal(start.toISOString(), '2024-01-31T17:00:00.000Z')
  assert.equal(end.toISOString(), '2024-02-29T17:00:00.000Z')
})

test('caps the current month at now and keeps future months empty', () => {
  const now = new Date('2026-11-12T12:00:00.000Z')
  const current = getGmDashboardQueryRange(2026, 11, now)
  assert.equal(current.end.toISOString(), now.toISOString())
  assert.equal(current.hasStarted, true)

  const future = getGmDashboardQueryRange(2026, 12, now)
  assert.equal(future.end.toISOString(), future.start.toISOString())
  assert.equal(future.hasStarted, false)
})
