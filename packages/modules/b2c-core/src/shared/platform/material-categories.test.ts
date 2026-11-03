import { describe, expect, it } from 'vitest'

import { groupMaterialCategories, lowestPriceCents } from './material-categories'

describe('lowestPriceCents', () => {
  it('takes the lowest EUR base price in cents', () => {
    expect(
      lowestPriceCents([
        { prices: [{ amount: 12.5, currency_code: 'eur' }, { amount: 9, currency_code: 'usd' }] },
        { prices: [{ amount: '4.95', currency_code: 'EUR' }] },
      ])
    ).toBe(495)
  })

  it('skips price list and rule prices', () => {
    expect(
      lowestPriceCents([
        {
          prices: [
            { amount: 10, currency_code: 'eur' },
            { amount: 1, currency_code: 'eur', price_list_id: 'plist_1' },
            { amount: 2, currency_code: 'eur', rules_count: 1 },
          ],
        },
      ])
    ).toBe(1000)
  })

  it('returns null without an EUR price', () => {
    expect(lowestPriceCents([{ prices: [] }])).toBeNull()
    expect(lowestPriceCents(undefined)).toBeNull()
  })
})

describe('groupMaterialCategories', () => {
  it('nests subcategories under their group in sort order', () => {
    const groups = groupMaterialCategories([
      { id: 's2', slug: 'katoen', name: 'Katoen', parent_id: 'g1', sort_order: 20 },
      { id: 'g2', slug: 'verf', name: 'Verf', parent_id: null, sort_order: 20 },
      { id: 's1', slug: 'wol', name: 'Wol', parent_id: 'g1', sort_order: 10 },
      { id: 'g1', slug: 'garen', name: 'Garen', parent_id: null, sort_order: 10 },
    ])
    expect(groups.map((g) => g.id)).toEqual(['g1', 'g2'])
    expect(groups[0].children.map((c) => c.id)).toEqual(['s1', 's2'])
    expect(groups[1].children).toEqual([])
  })
})
