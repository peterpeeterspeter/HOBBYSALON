// Offline source-bound regressions: Node 22+, no application/SDK imports or network.
// Run: node --experimental-vm-modules --test scripts/tests/commerce-single-seller.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const paths = {
  cart: 'apps/storefront/src/lib/commerce/medusa/cart.ts',
  actions: 'apps/storefront/src/app/actions/cart.ts',
  gate: 'apps/storefront/src/lib/commerce/payment-gate.ts',
};
const sources = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(resolve(root, path), 'utf8')]));
console.log('SOURCE_SHA256', JSON.stringify(Object.fromEntries(Object.entries(paths).map(([key, path]) => [path, createHash('sha256').update(sources[key]).digest('hex')]))));

const clone = (value) => structuredClone(value);
const item = (seller, id = `line_${seller}`) => ({ id, quantity: 1, variant: { product: { seller: { id: seller } } } });
const product = (variant, seller) => ({ id: `product_${variant}`, variants: [{ id: variant }], seller: { id: seller } });
const readyCart = (items = [item('A')]) => ({
  id: 'cart', items, email: 'fixture@example.test',
  shipping_address: { address_1: 'Synthetic fixture', country_code: 'be' },
  shipping_methods: [{ id: 'sm_A', shipping_option_id: 'option_A' }],
});

async function harness(options = {}) {
  let state = clone(options.cart ?? readyCart([]));
  let cookie = options.noCookie ? undefined : 'cart';
  const mutations = [];
  const attempts = [];
  const queries = [];
  const reads = [];
  const catalogue = options.products ?? [product('vA', 'A'), product('vB', 'B'), product('vA2', 'A')];
  const sdk = { store: {
    region: { async list() { return { regions: [{ id: 'region', name: 'Europe' }] }; } },
    product: { async list(query) {
      queries.push(clone(query));
      if (options.productError) throw options.productError;
      if (options.list) return options.list(query, queries.length);
      const offset = query.offset ?? 0;
      const limit = Math.min(query.limit ?? 100, options.pageSize ?? 100);
      return { products: clone(catalogue.slice(offset, offset + limit)), count: catalogue.length, offset, limit };
    } },
    cart: {
      async retrieve(id, query) {
        reads.push({ id, query: clone(query) });
        if (options.retrieveError) {
          const error = typeof options.retrieveError === 'function' ? options.retrieveError(id, reads.length) : options.retrieveError;
          if (error) throw error;
        }
        if (options.noCart) return { cart: null };
        if (options.noItems) return { cart: { id } };
        return { cart: clone(state) };
      },
      async create() { mutations.push({ kind: 'create' }); state = readyCart([]); state.id = 'replacement'; return { cart: clone(state) }; },
      async createLineItem(id, line) {
        attempts.push({ id, line: clone(line) });
        if (options.lineError) {
          const error = options.lineError(id, attempts.length);
          if (error) throw error;
        }
        mutations.push({ kind: 'add', id, line: clone(line) });
        const p = catalogue.find((p) => p.variants.some((v) => v.id === line.variant_id));
        state.items.push({ id: `line_${state.items.length}`, quantity: line.quantity, metadata: clone(line.metadata), variant: { product: clone(p) } });
        return { cart: clone(state) };
      },
      async updateLineItem(id, lineId, data) {
        mutations.push({ kind: 'update', id, lineId, data: clone(data) });
        const line = state.items.find((row) => row.id === lineId);
        if (line) line.quantity = data.quantity;
        return { cart: clone(state) };
      },
      async deleteLineItem(id, lineId) {
        mutations.push({ kind: 'remove', id, lineId });
        state.items = state.items.filter((row) => row.id !== lineId);
        return {};
      },
    },
  } };
  const context = vm.createContext({
    console, process: { env: { NODE_ENV: 'test', ...options.env } },
    fetch() { throw new Error('NETWORK_FORBIDDEN'); },
  });
  const cookieStore = {
    get() { return cookie ? { value: cookie } : undefined; },
    set(name, value) { mutations.push({ kind: 'cookie', name, value }); cookie = value; },
  };
  const stub = (name, exports) => new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context, identifier: name });
  const modules = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, new vm.SourceTextModule(stripTypeScriptTypes(source), { context, identifier: key })]));
  const stubs = {
    './client': stub('client', { sdk }),
    'next/headers': stub('headers', { cookies: async () => cookieStore }),
    'next/cache': stub('cache', { revalidatePath() {} }),
  };
  await modules.actions.link((specifier) => {
    if (specifier === '@/lib/commerce/medusa/cart') return modules.cart;
    if (specifier === '../payment-gate' || specifier === '@/lib/commerce/payment-gate') return modules.gate;
    if (stubs[specifier]) return stubs[specifier];
    throw new Error(`Unexpected import: ${specifier}`);
  });
  await modules.actions.evaluate();
  if (modules.gate.status === 'unlinked') await modules.gate.link(() => { throw new Error('Unexpected gate import'); });
  if (modules.gate.status !== 'evaluated') await modules.gate.evaluate();
  return { actions: modules.actions.namespace, cart: modules.cart.namespace, gate: modules.gate.namespace, mutations, attempts, queries, reads, state: () => clone(state) };
}

async function assertRejectedWithoutMutation(h, run) {
  const before = h.state();
  const result = await run();
  assert.equal(result.success, false, 'must reject the proposed cart');
  assert.equal(typeof result.message, 'string');
  assert.deepEqual(h.mutations, [], 'must not create/edit a cart or cookie on seller rejection');
  assert.deepEqual(h.state(), before);
}

for (const noCookie of [false, true]) {
  test(`empty-cart mixed bundle is rejected before every mutation (noCookie=${noCookie})`, async () => {
    const h = await harness({ noCookie });
    await assertRejectedWithoutMutation(h, () => h.actions.addBundleToCartAction('bundle', [{ variant_id: 'vA' }, { variant_id: 'vB' }]));
  });
}

for (const cart of [readyCart([]), readyCart([item('A')])]) {
  test(`unresolved variant fails closed with ${cart.items.length} existing items`, async () => {
    const h = await harness({ cart });
    await assertRejectedWithoutMutation(h, () => h.actions.addToCartAction('missing'));
  });
}

test('a later unresolved bundle variant cannot leave an earlier line behind', async () => {
  const h = await harness();
  await assertRejectedWithoutMutation(h, () => h.actions.addBundleToCartAction('bundle', [{ variant_id: 'vA' }, { variant_id: 'missing' }]));
});

for (const existing of [
  { id: 'unknown', variant: { product: {} } },
  null,
  item(''),
  item('   '),
  item(42),
  { variant: { product: { seller: { id: 'A' }, seller_id: 'B' } } },
]) {
  test(`missing or ambiguous existing seller data is rejected: ${JSON.stringify(existing)}`, async () => {
    const h = await harness({ cart: readyCart([item('A'), existing]) });
    await assertRejectedWithoutMutation(h, () => h.actions.addToCartAction('vA'));
  });
}

for (const options of [
  { noCart: true }, { noItems: true }, { retrieveError: { status: 503 } }, { productError: { status: 503 } },
]) {
  test(`inconclusive reads do not authorize a write: ${JSON.stringify(options)}`, async () => {
    const h = await harness(options);
    await assertRejectedWithoutMutation(h, () => h.actions.addToCartAction('vA'));
  });
}

test('a mixed existing cart rejects another line even from an existing seller', async () => {
  const h = await harness({ cart: readyCart([item('A'), item('B')]) });
  await assertRejectedWithoutMutation(h, () => h.actions.addToCartAction('vA'));
});

test('known second seller is rejected', async () => {
  const h = await harness({ cart: readyCart([item('A')]) });
  await assertRejectedWithoutMutation(h, () => h.actions.addToCartAction('vB'));
});

test('product with missing seller cannot be added to empty cart', async () => {
  const h = await harness({ products: [{ id: 'p', variants: [{ id: 'v' }] }] });
  await assertRejectedWithoutMutation(h, () => h.actions.addToCartAction('v'));
});

test('single-seller bundle validates all variants in one catalogue pass and preserves metadata', async () => {
  const h = await harness({ cart: readyCart([item('A')]) });
  const result = await h.actions.addBundleToCartAction('bundle', [
    { variant_id: 'vA', quantity: 2, product_id: 'untrusted_metadata_only' },
    { variant_id: 'vA2', quantity: 3 },
  ], 'Fixture bundle');
  assert.equal(result.success, true);
  assert.equal(result.added_count, 2);
  assert.equal(h.queries.length, 1, 'batch resolves the proposed set in one pass');
  const adds = h.mutations.filter((row) => row.kind === 'add');
  assert.deepEqual(adds.map((row) => row.line.quantity), [2, 3]);
  assert.equal(adds[0].line.metadata.bundle_id, 'bundle');
  assert.equal(adds[0].line.metadata.bundle_label, 'Fixture bundle');
});

test('single-seller first add still creates a cart and cookie', async () => {
  const h = await harness({ noCookie: true });
  assert.equal((await h.actions.addToCartAction('vA', 2)).success, true);
  assert.equal(h.mutations.filter((row) => row.kind === 'create').length, 1);
  assert.equal(h.mutations.filter((row) => row.kind === 'cookie').length, 1);
  assert.equal(h.state().items[0].quantity, 2);
});

test('lookup finds a variant beyond the first 100 using supported limit/offset pagination', async () => {
  const products = Array.from({ length: 100 }, (_, i) => product(`other_${i}`, 'A'));
  products.push(product('late', 'A'));
  const h = await harness({ products, cart: readyCart([item('A')]) });
  assert.equal(await h.cart.getSellerIdForVariant('late'), 'A');
  assert.deepEqual(h.queries.map((q) => q.offset), [0, 100]);
  for (const query of h.queries) {
    assert.deepEqual(Object.keys(query).sort(), ['fields', 'limit', 'offset']);
    assert.equal(query.limit, 100);
    assert.equal(query.fields, 'id,*variants,*seller');
  }
});

test('pagination follows actual returned page size when the server clamps limit', async () => {
  const h = await harness({ products: [product('first', 'A'), product('later', 'B')], pageSize: 1 });
  assert.equal(await h.cart.getSellerIdForVariant('later'), 'B');
  assert.deepEqual(h.queries.map((q) => q.offset), [0, 1]);
});

test('bounded scan exhaustion fails closed rather than authorizing an unresolved variant', async () => {
  const h = await harness({ list(query) {
    assert.ok(query.offset < 2000, 'lookup must be bounded to 20 pages of 100');
    return { products: Array.from({ length: 100 }, (_, i) => product(`other_${query.offset + i}`, 'A')), count: 100000, offset: query.offset, limit: 100 };
  } });
  await assertRejectedWithoutMutation(h, () => h.actions.addToCartAction('missing'));
  assert.equal(h.queries.length, 20);
});

test('checkout retrieval explicitly requests the established product seller relation', async () => {
  const h = await harness();
  await h.cart.getCartForCheckout('cart');
  assert.ok(h.reads.at(-1).query.fields.split(',').includes('*items.variant.product.seller'));
});

for (const flag of [undefined, 'false']) {
  for (const items of [[item('A'), item('B')], [item('A'), { id: 'unknown' }]]) {
    test(`readiness rejects mixed/unknown sellers with one shipping method, flag=${flag}: ${JSON.stringify(items)}`, async () => {
      const h = await harness({ env: { COMMERCE_SINGLE_SELLER_CART: flag } });
      const cart = readyCart(items);
      const before = clone(cart);
      assert.equal(h.gate.assertCartReadyForPayment(cart).ok, false);
      assert.deepEqual(cart, before);
      assert.deepEqual(h.mutations, []);
    });
  }
}

test('readiness permits a known single seller with shipping in BE and NL', async () => {
  const h = await harness();
  for (const country_code of ['be', 'nl']) {
    const cart = readyCart([item('A'), item('A', 'line_A2')]);
    cart.shipping_address.country_code = country_code;
    assert.equal(h.gate.assertCartReadyForPayment(cart).ok, true);
  }
});

test('shipping, country, address, empty cart and disabled-payment gates are retained', async () => {
  const h = await harness();
  for (const patch of [
    { shipping_methods: [] }, { items: [] }, { email: '' },
    { shipping_address: { address_1: 'Synthetic fixture', country_code: 'de' } },
    { shipping_address: { address_1: '', country_code: 'be' } },
  ]) assert.equal(h.gate.assertCartReadyForPayment({ ...readyCart(), ...patch }).ok, false);
  const disabled = await harness({ env: { COMMERCE_PAYMENTS_ENABLED: 'false' } });
  assert.equal(disabled.gate.assertCartReadyForPayment(readyCart()).ok, false);
});

test('bundle with a missing variant ID rejects the entire selection', async () => {
  const h = await harness();
  await assertRejectedWithoutMutation(h, () => h.actions.addBundleToCartAction('bundle', [{ variant_id: 'vA' }, { variant_id: '' }]));
});

for (const bundle of [false, true]) {
  test(`confirmed stale cart recovery retains valid single-seller add (bundle=${bundle})`, async () => {
    const h = await harness({ retrieveError(id) { return id === 'cart' ? { status: 404 } : null; } });
    const result = bundle
      ? await h.actions.addBundleToCartAction('bundle', [{ variant_id: 'vA' }, { variant_id: 'vA2' }])
      : await h.actions.addToCartAction('vA');
    assert.equal(result.success, true);
    assert.equal(h.mutations.filter((row) => row.kind === 'create').length, 1);
    assert.equal(h.mutations.filter((row) => row.kind === 'cookie').length, 1);
    assert.equal(h.mutations.at(-1).kind, 'cookie', 'replacement cookie is written only after progress');
  });
}

test('confirmed stale cart does not authorize a mixed replacement bundle', async () => {
  const h = await harness({ retrieveError: { status: 404 } });
  await assertRejectedWithoutMutation(h, () => h.actions.addBundleToCartAction('bundle', [{ variant_id: 'vA' }, { variant_id: 'vB' }]));
});

test('completed cart recovery validates the new single-seller cart', async () => {
  const h = await harness({ cart: { ...readyCart([item('B')]), completed_at: '2026-01-01T00:00:00Z' } });
  assert.equal((await h.actions.addToCartAction('vA')).success, true);
  assert.equal(h.mutations.filter((row) => row.kind === 'create').length, 1);
});

for (const bundle of [false, true]) {
  test(`seller lookup must be revalidated before a stale-write retry (bundle=${bundle})`, async () => {
    const h = await harness({
      retrieveError(id, read) { return id === 'cart' && read > 1 ? { status: 404 } : null; },
      lineError(id) { return id === 'cart' ? { status: 404 } : null; },
      list(query, call) { return { products: call === 1 ? [product('vA', 'A')] : [], count: call === 1 ? 1 : 0, offset: 0, limit: 100 }; },
    });
    await assertRejectedWithoutMutation(h, () => bundle
      ? h.actions.addBundleToCartAction('bundle', [{ variant_id: 'vA' }])
      : h.actions.addToCartAction('vA'));
    assert.equal(h.attempts.length, 1, 'no retry after the seller lookup becomes inconclusive');
  });
}

test('normal quantity/remove editing remains available to repair an unknown-seller cart', async () => {
  const h = await harness({ cart: readyCart([{ id: 'unknown', quantity: 1 }]), productError: { status: 503 } });
  assert.equal((await h.actions.updateCartLineItemQuantityAction('unknown', 3.9)).success, true);
  assert.equal(h.state().items[0].quantity, 3);
  assert.equal((await h.actions.updateCartLineItemQuantityAction('unknown', 0)).success, false);
  assert.equal((await h.actions.removeFromCartAction('unknown')).success, true);
  assert.deepEqual(h.state().items, []);
  assert.deepEqual(h.mutations.map((row) => row.kind), ['update', 'remove']);
  assert.equal(h.queries.length, 0);
});
