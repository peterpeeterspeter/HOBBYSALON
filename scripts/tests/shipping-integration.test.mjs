import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const root = new URL('../../', import.meta.url);
const base = 'packages/modules/b2c-core/src/';
function load(file, context) {
  const source = readFileSync(new URL(base + file, root), 'utf8').replace(
    /^import[\s\S]*?from ["'][^"']+["'];?\r?\n/gm,
    ''
  );
  vm.runInContext(
    stripTypeScriptTypes(source).replace(/^export /gm, ''),
    context,
    { filename: file }
  );
}
function fixture() {
  const state = {
    total: 75,
    country: 'be',
    frozen: false,
    policies: [
      {
        id: 'p',
        seller_id: 'a',
        country_code: 'be',
        currency_code: 'eur',
        free_shipping_threshold: 75,
        shipping_option_ids: ['standard']
      }
    ],
    price: 6.95,
    adjustments: [{ id: 'discount', amount: 3 }],
    calls: [],
    profile: 'profile',
    fail: false,
    store: 'ACTIVE',
    optionCode: 'standard',
    owner: 'a',
    optionCountry: 'be',
    sessions: []
  };
  class MedusaError extends Error {
    static Types = {
      INVALID_DATA: 'invalid',
      NOT_FOUND: 'missing',
      CONFLICT: 'conflict'
    };
    constructor(type, message) {
      super(message);
      this.type = type;
    }
  }
  const methods = () => [
    {
      id: 'method',
      shipping_option_id: 'standard',
      amount: state.price,
      adjustments: state.adjustments
    }
  ];
  const cartService = {
    async softDeleteShippingMethodAdjustments(ids) {
      state.calls.push('delete');
      state.removed = state.adjustments;
      state.adjustments = [];
    },
    async restoreShippingMethodAdjustments(ids) {
      state.calls.push('restore');
      state.adjustments = state.removed;
    },
    async updateShippingMethods(rows) {
      if (state.fail) {
        state.fail = false;
        throw Error('write failed');
      }
      state.calls.push('price');
      state.price = Number(rows[0].amount);
    }
  };
  const sellerService = {
    async listSellerShippingPolicies(filter) {
      return state.policies.filter(
        (p) =>
          !filter.seller_id ||
          (Array.isArray(filter.seller_id)
            ? filter.seller_id.includes(p.seller_id)
            : filter.seller_id === p.seller_id)
      );
    },
    async updateSellerShippingPolicies(data) {
      state.calls.push('save');
      Object.assign(state.policies[0], data);
      return state.policies[0];
    },
    async createSellerShippingPolicies(data) {
      state.calls.push('create');
      state.policies.push(data);
      return data;
    }
  };
  const query = {
    async graph({ entity, fields }) {
      if (entity === 'cart')
        return {
          data: [
            {
              id: 'cart',
              currency_code: 'eur',
              completed_at: null,
              shipping_address: { country_code: state.country },
              items: [
                {
                  id: 'line',
                  product_id: 'product',
                  total: fields.includes('total') ? state.total : undefined,
                  requires_shipping: true
                }
              ],
              shipping_methods: methods(),
              payment_collection: {
                payment_sessions: state.frozen ? [{ id: 'paid' }] : []
              }
            }
          ]
        };
      if (entity === 'product_link')
        return {
          data: [
            {
              seller_id: 'a',
              product_id: 'product',
              product: {
                shipping_profile: { id: state.profile },
                status: 'published'
              },
              seller: { name: 'Shop A' }
            }
          ]
        };
      if (entity === 'option_link')
        return {
          data: [
            {
              seller_id: state.owner,
              seller: { store_status: state.store },
              shipping_option: state.optionDeleted ? null : {
                id: 'standard',
                name: 'Standaard',
                price_type: 'flat',
                shipping_profile_id: 'profile',
                type: { code: state.optionCode },
                rules: [],
                prices: [{ currency_code: 'eur', amount: 6.95 }],
                provider: { is_enabled: true },
                service_zone: {
                  fulfillment_set: { type: 'shipping' },
                  geo_zones: [
                    { type: 'country', country_code: state.optionCountry }
                  ]
                }
              }
            }
          ]
        };
      throw Error(entity);
    }
  };
  const container = {
    resolve: (key) => ({ query, seller: sellerService, cart: cartService })[key]
  };
  const hooks = {};
  const context = vm.createContext({
    console,
    MedusaError,
    ContainerRegistrationKeys: { QUERY: 'query' },
    Modules: { CART: 'cart' },
    sellerProduct: { entryPoint: 'product_link' },
    sellerOption: { entryPoint: 'option_link' },
    StepResponse: class {
      constructor(result, backup) {
        this.result = result;
        this.backup = backup;
      }
    },
    refreshCartItemsWorkflow: {
      hooks: {
        setPricingContext: (fn, rollback) => {
          hooks.guard = fn;
          hooks.guardRollback = rollback;
        },
        beforeRefreshingPaymentCollection: (fn, rollback) => {
          hooks.apply = fn;
          hooks.rollback = rollback;
        }
      }
    },
    listShippingOptionsForCartWithPricingWorkflow: () => ({
      run: async () => ({
        result: [
          {
            id: 'standard',
            calculated_price: {
              calculated_amount: 6.95,
              is_calculated_price_tax_inclusive: true
            }
          }
        ]
      })
    }),
    fetchSellerByAuthActorId: async () => ({ id: 'a' })
  });
  load('shared/shipping/policy.ts', context);
  load('shared/shipping/data.ts', context);
  load('workflows/hooks/seller-free-shipping.ts', context);
  return {
    state,
    context,
    container,
    hooks,
    apply: () => hooks.apply({ input: { cart_id: 'cart' } }, { container })
  };
}
test('real cart query uses seller product relation, after-discount totals and actual destination', async () => {
  const f = fixture();
  let s = await f.context.cartShippingState(f.container, 'cart');
  assert.equal(s.summaries[0].qualified, true);
  f.state.total = 72;
  s = await f.context.cartShippingState(f.container, 'cart');
  assert.equal(s.summaries[0].remaining_amount, 3);
  f.state.country = 'nl';
  s = await f.context.cartShippingState(f.container, 'cart');
  assert.equal(s.summaries.length, 0);
});
test('zero shipping removes promotion adjustments, and compensation restores both', async () => {
  const f = fixture();
  const response = await f.apply();
  assert.equal(f.state.price, 0);
  assert.equal(f.state.adjustments.length, 0);
  await f.hooks.rollback(response.backup, { container: f.container });
  assert.equal(f.state.price, 6.95);
  assert.equal(f.state.adjustments[0].amount, 3);
});
test('a partial write failure restores the removed shipping discount', async () => {
  const f = fixture();
  f.state.fail = true;
  await assert.rejects(f.apply(), /write failed/);
  assert.equal(f.state.price, 6.95);
  assert.equal(f.state.adjustments[0].amount, 3);
});
for (const [field, value] of [
  ['optionCode', 'express'],
  ['optionCode', 'pickup'],
  ['store', 'INACTIVE'],
  ['owner', 'b'],
  ['optionCountry', 'nl'],
  ['profile', 'other']
])
  test(`ineligible option cannot become free: ${field}=${value}`, async () => {
    const f = fixture();
    f.state[field] = value;
    await f.apply();
    assert.equal(f.state.price, 6.95);
    assert.equal(f.state.adjustments.length, 1);
  });
test('paid or uncertain sessions refuse repricing without any writes', async () => {
  const f = fixture();
  f.state.frozen = true;
  await assert.rejects(f.apply(), /betaling/);
  assert.equal(f.state.calls.length, 0);
  await assert.rejects(
    f.hooks.guard({ cart_id: 'cart' }, { container: f.container }),
    /betaling/
  );
});
test('below the threshold keeps the native restored tariff and native shipping promotion', async () => {
  const f = fixture();
  f.state.total = 74.99;
  await f.apply();
  assert.equal(f.state.price, 6.95);
  assert.equal(f.state.adjustments[0].amount, 3);
  assert.equal(f.state.calls.length, 0);
});
test('vendor cannot configure another seller option or inject a seller id', async () => {
  const f = fixture();
  load('api/vendor/shipping-policies/[country_code]/route.ts', f.context);
  const req = {
    params: { country_code: 'be' },
    auth_context: { actor_id: 'member' },
    scope: f.container,
    body: { free_shipping_threshold: 75, shipping_option_ids: ['foreign'] }
  };
  await assert.rejects(f.context.POST(req, { json() {} }), /verzendmethode/);
  assert.equal(f.state.calls.length, 0);
  req.body = {
    free_shipping_threshold: 75,
    shipping_option_ids: ['standard'],
    seller_id: 'b'
  };
  await assert.rejects(f.context.POST(req, { json() {} }), /Ongeldige/);
});
test('vendor saves numeric zero separately from disabled null', async () => {
  const f = fixture();
  load('api/vendor/shipping-policies/[country_code]/route.ts', f.context);
  const req = {
    params: { country_code: 'be' },
    auth_context: { actor_id: 'member' },
    scope: f.container,
    body: { free_shipping_threshold: 0, shipping_option_ids: ['standard'] }
  };
  await f.context.POST(req, { json() {} });
  assert.equal(f.state.policies[0].free_shipping_threshold, 0);
  req.body = { free_shipping_threshold: null, shipping_option_ids: [] };
  await f.context.POST(req, { json() {} });
  assert.equal(f.state.policies[0].free_shipping_threshold, null);
});

test('first refresh below the threshold restores the base before shipping-promotion allocation', async () => {
  const f = fixture();
  f.state.price = 0;
  f.state.adjustments = [];
  f.state.total = 74.99;
  const prior = await f.hooks.guard(
    { cart_id: 'cart' },
    { container: f.container }
  );
  assert.equal(f.state.price, 6.95);
  // Native promotion allocation now sees the restored base.
  f.state.adjustments = [{ id: 'discount', amount: 3 }];
  await f.apply();
  assert.equal(f.state.price, 6.95);
  assert.equal(f.state.adjustments[0].amount, 3);
  await f.hooks.guardRollback(prior.backup, { container: f.container });
  assert.equal(f.state.price, 0);
});

test('legacy portal methods can be explicitly designated as standard delivery', async () => {
  const f = fixture();
  f.state.optionCode = 'type-code';
  await f.apply();
  assert.equal(f.state.price, 0);
});

test('BE and NL policies remain independent even in a shared zone', async () => {
  const f = fixture();
  f.state.country = 'nl'; f.state.optionCountry = 'nl';
  f.state.policies.push({ ...f.state.policies[0], id: 'nl-policy', country_code: 'nl', free_shipping_threshold: 100 });
  const state = await f.context.cartShippingState(f.container, 'cart');
  assert.equal(state.summaries.length, 1);
  assert.equal(state.summaries[0].threshold_amount, 100);
  assert.equal(state.summaries[0].remaining_amount, 25);
  await f.apply(); assert.equal(f.state.price, 6.95);
});

test('removing every selected method does not manufacture free shipping', async () => {
  const f = fixture(); f.state.policies[0].shipping_option_ids = [];
  const state = await f.context.cartShippingState(f.container, 'cart');
  assert.equal(state.summaries[0].available, false);
  await f.apply(); assert.equal(f.state.price, 6.95);
});

test('disabled policy restores native pricing but does not grant free shipping', async () => {
  const f = fixture(); f.state.policies[0].free_shipping_threshold = null;
  f.state.price = 0;
  await f.hooks.guard({cart_id:'cart'}, {container:f.container});
  await f.apply(); assert.equal(f.state.price, 6.95);
});

test('deleted native option relations are unavailable and no longer public', async () => {
  const f = fixture();
  f.state.optionDeleted = true;
  await f.apply();
  assert.equal(f.state.price, 6.95);
  assert.equal(f.state.adjustments.length, 1);
  const state = await f.context.cartShippingState(f.container, 'cart');
  assert.equal(state.summaries[0].available, false);
  load('api/store/products/[id]/shipping-policy/route.ts', f.context);
  let body;
  await f.context.GET({ scope: f.container, params: { id: 'product' } }, { setHeader() {}, json(value) { body = value; } });
  assert.equal(body.shipping_policies.length, 0);
});
