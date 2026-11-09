import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTicketListOwnerFilter } from '@/lib/tickets-list-cache'

test('Creator Digital PSB list mengikuti aturan nama marketing', () => {
  assert.deepEqual(buildTicketListOwnerFilter('CREATOR_DIGITAL', 'Iman'), {
    marketingName: { equals: 'Iman', mode: 'insensitive' },
  })
})

test('Scope PSB menyamakan MARKETING dan CREATOR_DIGITAL', () => {
  assert.deepEqual(buildTicketListOwnerFilter('MARKETING', '  Iman   Digital '), {
    marketingName: { equals: 'Iman Digital', mode: 'insensitive' },
  })
  assert.deepEqual(buildTicketListOwnerFilter('CREATOR_DIGITAL', '  Iman   Digital '), {
    marketingName: { equals: 'Iman Digital', mode: 'insensitive' },
  })
})

test('Scope PSB gagal tertutup saat nama akun tidak tersedia', () => {
  assert.deepEqual(buildTicketListOwnerFilter('CREATOR_DIGITAL', ''), { id: { lt: 0 } })
  assert.deepEqual(buildTicketListOwnerFilter('CREATOR_DIGITAL', null), { id: { lt: 0 } })
  assert.deepEqual(buildTicketListOwnerFilter('CREATOR_DIGITAL', undefined), { id: { lt: 0 } })
  assert.deepEqual(buildTicketListOwnerFilter('MARKETING', '   '), { id: { lt: 0 } })
})

test('Role tanpa scope nama mempertahankan visibilitas PSB yang ada', () => {
  assert.equal(buildTicketListOwnerFilter('ADMIN', 'Iman'), null)
  assert.equal(buildTicketListOwnerFilter('CS', 'Iman'), null)
})
