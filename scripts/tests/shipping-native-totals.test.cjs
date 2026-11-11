const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getShippingMethodTotals } = require('@medusajs/utils');
for (const inclusive of [true, false]) {
  test(`Medusa 2.11.3 shipping VAT and promotion totals (inclusive=${inclusive})`, () => {
    const method = {
      amount: 6.95,
      is_tax_inclusive: inclusive,
      tax_lines: [{ rate: 21 }],
      adjustments: [{ amount: 3 }]
    };
    const paid = getShippingMethodTotals(structuredClone(method), {
      includeTax: inclusive
    });
    assert.ok(Number(paid.total) > 0);
    const free = getShippingMethodTotals(
      { ...structuredClone(method), amount: 0, adjustments: [] },
      { includeTax: inclusive }
    );
    assert.equal(Number(free.total), 0);
    assert.equal(Number(free.tax_total), 0);
    const reverted = getShippingMethodTotals(structuredClone(method), {
      includeTax: inclusive
    });
    assert.equal(Number(reverted.total), Number(paid.total));
    assert.equal(Number(reverted.tax_total), Number(paid.tax_total));
  });
}
