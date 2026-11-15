import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isExcludedMarketingActivityIdentity,
  resolveMarketingActivityName,
  type MarketingActivityDirectory,
} from '@/lib/marketing-activity-directory'

test('activity directory excludes management and support accounts', () => {
  const excludedAccounts = [
    { name: 'Indra', role: 'MARKETING', position: 'Manager' },
    { name: 'Chintia', role: 'MARKETING', position: 'SPV', subdivision: 'Marketing' },
    { name: 'Kantor', role: 'MARKETING', subdivision: 'Kantor' },
    { name: 'NOC Kantor', role: 'NOC', division: 'Kantor' },
    { name: 'Rizky', role: 'CREATOR_DIGITAL', subdivision: 'Digital Creator' },
  ]

  for (const account of excludedAccounts) {
    assert.equal(isExcludedMarketingActivityIdentity(account), true, account.name)
  }
  assert.equal(
    isExcludedMarketingActivityIdentity({ name: 'Wahyu', role: 'MARKETING', position: 'Staff', subdivision: 'Marketing' }),
    false
  )
})

test('activity name resolution only accepts eligible marketing names', () => {
  const directory: MarketingActivityDirectory = {
    marketingUsers: [{ id: 1, name: 'Wahyu', username: 'wahyu' }],
    excludedNameKeys: ['manager', 'spv', 'kantor', 'digital creator'],
  }

  assert.equal(resolveMarketingActivityName(' wahyu ', directory), 'Wahyu')
  assert.equal(resolveMarketingActivityName('Kantor', directory), null)
  assert.equal(resolveMarketingActivityName('Unknown', directory), null)
})
