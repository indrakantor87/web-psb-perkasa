import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTicketListOwnerFilter } from '@/lib/tickets-list-cache'

test('Creator Digital PSB list filter is limited to the account owner', () => {
  assert.deepEqual(buildTicketListOwnerFilter('CREATOR_DIGITAL', 42), { createdById: 42 })
})

test('Creator Digital PSB list filter fails closed without an account id', () => {
  assert.deepEqual(buildTicketListOwnerFilter('CREATOR_DIGITAL', null), { createdById: -1 })
  assert.deepEqual(buildTicketListOwnerFilter('CREATOR_DIGITAL', undefined), { createdById: -1 })
})

test('unscoped roles retain their existing PSB list visibility', () => {
  assert.equal(buildTicketListOwnerFilter('ADMIN', 42), null)
})
