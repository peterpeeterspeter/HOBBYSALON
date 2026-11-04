import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(new URL('../../apps/vendor-panel/package.json', import.meta.url));
const { z } = require('zod');
const source = readFileSync(new URL('../../packages/modules/b2c-core/src/api/vendor/shipping-options/validators.ts', import.meta.url), 'utf8');
const context = vm.createContext({ z, PricingRuleOperator: { EQ: 'eq' }, RuleOperator: { EQ: 'eq' }, createFindParams: () => z.object({}) });
vm.runInContext(stripTypeScriptTypes(source.replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '')).replace(/^export /gm, '') + '\nglobalThis.schemas = { create: VendorCreateShippingOption, update: VendorUpdateShippingOption };', context);
const { create, update } = context.schemas;
const option = { name: 'Standard', service_zone_id: 'zone', shipping_profile_id: 'profile', provider_id: 'manual_manual', type: { label: 'Standard', description: 'Standard shipping', code: 'standard' } };

test('a fixed shipping option requires a price, including explicit zero for free shipping', () => {
  assert.equal(create.safeParse({ ...option, prices: [] }).success, false);
  assert.equal(create.safeParse(option).success, false);
  for (const amount of [0, 6.95]) {
    assert.equal(create.safeParse({ ...option, prices: [{ currency_code: 'eur', amount }] }).success, true);
    assert.equal(create.safeParse({ ...option, prices: [{ region_id: 'be', amount }] }).success, true);
  }
});

test('updating details can omit prices, but cannot erase every shipping price', () => {
  assert.equal(update.safeParse({ name: 'Renamed' }).success, true);
  assert.equal(update.safeParse({ prices: [] }).success, false);
  assert.equal(update.safeParse({ prices: [{ currency_code: 'eur', amount: 0 }] }).success, true);
});
