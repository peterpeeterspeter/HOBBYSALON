// Run: node --test scripts/tests/commerce-payment-recovery.test.mjs (Node 22.13+).
// Executes repository action/route bodies, with only imports and TS types removed.
// No application bootstrap, installed dependencies, real Stripe, DB, or network.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const paths = {
  action: "apps/storefront/src/app/actions/checkout.ts",
  cart: "apps/storefront/src/lib/commerce/medusa/cart.ts",
  route: "apps/backend/src/api/store/carts/[id]/payment-client-secret/route.ts",
  policy: "apps/backend/src/api/middlewares/commerce-payment-policy.ts",
  middlewares: "apps/backend/src/api/middlewares.ts",
};
const source = (path) => readFileSync(new URL(path, root), "utf8");
function load(text, context, filename) {
  const noImports = text.replace(/^import[\s\S]*?from ["'][^"']+["'];?\r?\n/gm, "");
  const js = stripTypeScriptTypes(noImports)
    .replace(/^export default /gm, "globalThis.middlewareConfig = ")
    .replace(/^export /gm, "");
  vm.runInContext(js, context, { filename });
}
const quiet = { error() {}, warn() {}, log() {} };
const pausedMessage = /Betalingen zijn tijdelijk uitgeschakeld/;
const recoveryMessage = /bestaande betaling.*niet.*vaststellen/i;
function response() {
  return {
    code: 200,
    body: undefined,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function checkout({ sessions = [{ id: "ps_fixture" }], httpStatus = 200,
  body = {}, networkError = false, paused = false, completeFails = false,
  initiateFails = false, transport } = {}) {
  const calls = { initiated: 0, completed: 0, fetched: 0, providers: 0, cookiesDeleted: 0, methods: [] };
  const cart = { id: "cart_fixture", region_id: "region_fixture", items: [],
    payment_collection: { payment_sessions: sessions } };
  const context = vm.createContext({
    console: quiet, process: { env: { NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: "offline-publishable" } }, URLSearchParams,
    CART_COOKIE_NAME: "cart_cookie", getBackendUrl: () => "https://offline.invalid",
    cookies: async () => ({ get: () => ({ value: cart.id }), delete: () => calls.cookiesDeleted++ }),
    getCartForCheckout: async () => cart,
    // Cart/address/seller readiness is a separate worker's contract.
    assertCartReadyForPayment: () => paused
      ? { ok: false, message: "Betalingen zijn tijdelijk uitgeschakeld. Probeer het later opnieuw." }
      : { ok: true },
    getPaymentProviders: async () => { calls.providers++; return [{ id: "pp_stripe_fixture" }]; },
    medusaAmountToCents: (amount) => Math.round(amount * 100),
    fetch: async (url, options) => {
      calls.fetched++;
      assert.equal(url, "https://offline.invalid/store/carts/cart_fixture/payment-client-secret");
      calls.methods.push(options.method);
      assert.equal(options.method, "POST", "only explicit checkout requests may recover sessions");
      assert.equal(options.headers["x-publishable-api-key"], "offline-publishable");
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.equal(options.headers.Authorization, undefined, "guest checkout must not require customer auth");
      assert.equal(options.body, undefined, "preserve the bodyless cart-ID contract");
      if (networkError) throw Error("offline transport failure");
      const result = transport ? await transport(options.method) : { code: httpStatus, body };
      return { ok: result.code >= 200 && result.code < 300, json: async () => result.body };
    },
    sdk: { store: {
      payment: { initiatePaymentSession: async () => {
        calls.initiated++;
        if (initiateFails) throw Error("offline initiation failure");
        return { payment_collection: cart.payment_collection };
      } },
      cart: { complete: async () => {
        calls.completed++;
        return completeFails ? { type: "cart", error: { message: "Afronden mislukt" } }
          : { type: "order", order_set: { id: "order_fixture" } };
      } },
    } },
    redirect() { throw Error("unexpected redirect"); },
    revalidatePath() {},
  });
  const helperSource = source(paths.cart);
  const start = helperSource.indexOf("export async function getPaymentClientSecret(");
  assert.notEqual(start, -1);
  // Includes the real response adapter, initiation wrapper, and completion wrapper.
  load(helperSource.slice(start), context, paths.cart);
  load(source(paths.action), context, paths.action);
  return { context, calls };
}

function backend({ paused = false, status = "requires_payment_method", secret = "old_secret",
  intentId = "pi_fixture", retrieveFails = false, createFails = false,
  stripeKey = true, noSession = false, listFallback = false } = {}) {
  const calls = { retrieved: 0, created: 0, deleted: 0, effects: [] };
  const data = { ...(intentId ? { id: intentId } : {}), ...(secret ? { client_secret: secret } : {}) };
  const session = { id: "ps_fixture", provider_id: "pp_stripe_fixture", data };
  const context = vm.createContext({
    console: quiet,
    process: { env: { COMMERCE_PAYMENTS_ENABLED: paused ? "false" : "true",
      ...(stripeKey ? { STRIPE_SECRET_API_KEY: "offline-placeholder" } : {}) } },
    ContainerRegistrationKeys: { QUERY: "query" }, Modules: { PAYMENT: "payment" },
    Stripe: class { constructor() { this.paymentIntents = { retrieve: async (id) => {
      calls.retrieved++;
      calls.effects.push("retrieve");
      assert.equal(id, "pi_fixture");
      if (retrieveFails) throw Error("offline status failure");
      return { id, status, client_secret: secret };
    } }; } },
  });
  if (existsSync(new URL(paths.policy, root))) load(source(paths.policy), context, paths.policy);
  load(source(paths.route), context, paths.route);
  const services = {
    query: { graph: async () => ({ data: [{ id: "cart_fixture", total: 12, currency_code: "eur",
      payment_collection: { id: "pc_fixture", amount: 12, currency_code: "eur",
        payment_sessions: noSession || listFallback ? [] : [session] } }] }) },
    payment: {
      listPaymentSessions: async () => noSession ? [] : [session],
      deletePaymentSession: async (id) => {
        calls.deleted++;
        calls.effects.push("delete");
        assert.equal(id, "ps_fixture");
      },
      createPaymentSession: async (collectionId, input) => {
        calls.created++;
        calls.effects.push("create");
        assert.equal(collectionId, "pc_fixture");
        assert.equal(input.provider_id, "pp_stripe_fixture");
        assert.equal(input.amount, 12);
        assert.equal(input.currency_code, "eur");
        if (createFails) throw Error("offline creation failure");
        return { id: "ps_new", data: { client_secret: "new_secret" } };
      },
    },
  };
  async function run(method = "GET") {
    const res = response();
    assert.equal(typeof context[method], "function", `${method} route must be exported`);
    await context[method]({ method, params: { id: "cart_fixture" }, scope: { resolve: (key) => services[key] } }, res);
    return res;
  }
  return { calls, run };
}

for (const [name, options] of [
  ["HTTP failure", { httpStatus: 500, body: { message: "provider status unknown" } }],
  ["network failure", { networkError: true }],
  ["202 processing without secret", { httpStatus: 202, body: { message: "Payment is still processing" } }],
  ["empty 200 response", {}],
]) {
  test(`existing checkout: ${name} cannot initiate a replacement`, async () => {
    const { context, calls } = checkout(options);
    const result = await context.checkoutInitiatePayment();
    assert.equal(calls.initiated, 0, "uncertainty must not fall through to initiation");
    assert.equal(calls.providers, 0);
    assert.equal(result.success, false);
    assert.match(result.message, recoveryMessage);
    assert.deepEqual(calls.methods, ["POST"]);
  });
}

test("explicit checkout POST reuses a valid secret without initiation", async () => {
  const { context, calls } = checkout({ body: { client_secret: "valid_secret" } });
  const result = await context.checkoutInitiatePayment();
  assert.equal(result.clientSecret, "valid_secret");
  assert.equal(result.success, true);
  assert.equal(calls.initiated, 0);
  assert.deepEqual(calls.methods, ["POST"]);
});

for (const completeFails of [false, true]) {
  test(`confirmed paid checkout never initiates again (completion failure=${completeFails})`, async () => {
    const { context, calls } = checkout({ body: { payment_succeeded: true }, completeFails });
    const result = await context.checkoutInitiatePayment();
    assert.equal(calls.initiated, 0);
    assert.equal(calls.completed, 1);
    assert.equal(result.success, !completeFails);
    assert.equal(completeFails ? result.payment_already_succeeded : result.payment_already_completed, true);
    assert.equal(calls.cookiesDeleted, completeFails ? 0 : 1);
  });
}

test("new checkout still initiates when enabled", async () => {
  const { context, calls } = checkout({ sessions: [], body: { client_secret: "new_secret" } });
  assert.equal((await context.checkoutInitiatePayment()).clientSecret, "new_secret");
  assert.equal(calls.initiated, 1);
});

test("failed initial creation still recovers confirmed paid completion", async () => {
  const { context, calls } = checkout({ sessions: [], initiateFails: true, body: { payment_succeeded: true } });
  assert.equal((await context.checkoutInitiatePayment()).payment_already_completed, true);
  assert.equal(calls.completed, 1);
});

test("pause blocks a new checkout but does not block the completion action", async () => {
  const { context, calls } = checkout({ sessions: [], paused: true });
  assert.match((await context.checkoutInitiatePayment()).message, pausedMessage);
  assert.equal(calls.initiated, 0);
  assert.equal((await context.checkoutComplete({ redirect: false })).success, true);
  assert.equal(calls.completed, 1);
});

for (const listFallback of [false, true]) {
  test(`paused POST refuses canceled-session recreation (list fallback=${listFallback})`, async () => {
    const fixture = backend({ paused: true, status: "canceled", listFallback });
    const res = await fixture.run("POST");
    assert.equal(fixture.calls.created, 0, "pause must stop provider creation");
    assert.equal(fixture.calls.deleted, 0, "pause must preserve the existing session");
    assert.equal(res.code, 503);
    assert.equal(res.body.client_secret, undefined);
    assert.match(res.body.message, pausedMessage);
  });
}

test("paused GET refuses empty-session fallback creation", async () => {
  const fixture = backend({ paused: true, intentId: null, secret: null });
  const res = await fixture.run();
  assert.equal(fixture.calls.created, 0);
  assert.equal(fixture.calls.deleted, 0);
  assert.equal(res.code, 503);
  assert.equal(res.body.client_secret, undefined);
});

test("missing provider identity is inconclusive even when enabled", async () => {
  const fixture = backend({ intentId: null, secret: null });
  const res = await fixture.run();
  assert.equal(fixture.calls.created, 0, "missing identity is not proof the provider never created a payment");
  assert.equal(fixture.calls.deleted, 0);
  assert.equal(res.body.client_secret, undefined);
});

test("confirmed canceled POST can recreate when enabled", async () => {
  const fixture = backend({ status: "canceled" });
  assert.equal((await fixture.run("POST")).body.client_secret, "new_secret");
  assert.equal(fixture.calls.created, 1);
  assert.equal(fixture.calls.deleted, 1);
});

test("failed canceled recreation never returns the canceled intent's cached secret", async () => {
  const fixture = backend({ status: "canceled", createFails: true });
  assert.equal((await fixture.run("POST")).body.client_secret, undefined);
  assert.equal(fixture.calls.created, 1, "must not retry recreation in this request");
});

for (const options of [
  { status: "processing", secret: null },
  { retrieveFails: true, secret: null },
  { stripeKey: false, secret: null },
  { status: "unrecognized", secret: null },
  { intentId: null, secret: null },
]) {
  test(`inconclusive POST-to-adapter-to-action cannot initiate: ${JSON.stringify(options)}`, async () => {
    const route = backend(options);
    const { context, calls } = checkout({ transport: route.run });
    assert.equal((await context.checkoutInitiatePayment()).success, false);
    assert.deepEqual(calls.methods, ["POST"]);
    assert.equal(calls.initiated, 0);
    assert.equal(route.calls.created, 0);
    assert.equal(route.calls.deleted, 0);
  });
}

for (const status of ["succeeded", "requires_payment_method", "processing"]) {
  test(`paused GET preserves ${status} response without creation`, async () => {
    const fixture = backend({ paused: true, status });
    const res = await fixture.run();
    assert.equal(res.code, 200);
    assert.equal(res.body.client_secret, "old_secret");
    assert.equal(Boolean(res.body.payment_succeeded), status === "succeeded");
    assert.equal(fixture.calls.created, 0);
    assert.equal(fixture.calls.deleted, 0);
  });
}

for (const paused of [false, true]) {
  for (const listFallback of [false, true]) {
    test(`canceled GET is read-only (paused=${paused}, list fallback=${listFallback})`, async () => {
      const route = backend({ status: "canceled", paused, listFallback });
      const res = await route.run("GET");
      assert.equal(route.calls.deleted, 0, "GET must never delete a canceled session");
      assert.equal(route.calls.created, 0, "GET must never create a replacement");
      assert.equal(route.calls.retrieved, 1);
      assert.equal(res.code, paused ? 503 : 409);
      assert.equal(res.body.client_secret, undefined, "never expose the canceled intent's secret");
    });
  }
}

for (const method of ["GET", "POST"]) {
  for (const options of [
    { retrieveFails: true },
    { intentId: null, secret: null },
    { status: "unrecognized" },
    { status: "requires_action" },
    { status: "requires_confirmation" },
    { status: "requires_capture" },
    { stripeKey: false },
    { noSession: true },
  ]) {
    test(`${method} never mutates uncertain or active payments: ${JSON.stringify(options)}`, async () => {
      const route = backend(options);
      await route.run(method);
      assert.equal(route.calls.deleted, 0);
      assert.equal(route.calls.created, 0);
    });
  }
}

for (const listFallback of [false, true]) {
  test(`explicit checkout recovers canceled payment through real POST/adapter/action (list fallback=${listFallback})`, async () => {
    const route = backend({ status: "canceled", listFallback });
    const read = await route.run("GET");
    assert.equal(read.code, 409);
    assert.equal(read.body.client_secret, undefined);
    assert.deepEqual(route.calls.effects, ["retrieve"], "the preceding read must not mutate");
    const { context, calls } = checkout({ transport: route.run });
    const result = await context.checkoutInitiatePayment();
    assert.deepEqual(calls.methods, ["POST"]);
    assert.equal(result.success, true);
    assert.equal(result.clientSecret, "new_secret");
    assert.equal(route.calls.deleted, 1);
    assert.equal(route.calls.created, 1);
    assert.deepEqual(route.calls.effects, ["retrieve", "retrieve", "delete", "create"]);
    assert.equal(calls.initiated, 0, "do not create a second session via SDK");
  });
}

for (const status of ["succeeded", "processing", "canceled"]) {
  test(`paused POST-to-adapter-to-checkout preserves ${status} safeguards`, async () => {
    const route = backend({ status, paused: true });
    const { context, calls } = checkout({ transport: route.run });
    const result = await context.checkoutInitiatePayment();
    assert.deepEqual(calls.methods, ["POST"]);
    assert.equal(route.calls.deleted, 0);
    assert.equal(route.calls.created, 0);
    assert.equal(calls.initiated, 0);
    assert.equal(calls.completed, status === "succeeded" ? 1 : 0);
    assert.equal(result.success, status !== "canceled");
    if (status === "processing") assert.equal(result.clientSecret, "old_secret");
  });
}

test("failed canceled POST recovery through adapter/action never returns a stale secret or retries initiation", async () => {
  const route = backend({ status: "canceled", createFails: true });
  const { context, calls } = checkout({ transport: route.run });
  const result = await context.checkoutInitiatePayment();
  assert.equal(result.success, false);
  assert.equal(result.clientSecret, undefined);
  assert.deepEqual(calls.methods, ["POST"]);
  assert.equal(calls.initiated, 0);
  assert.equal(route.calls.deleted, 1);
  assert.equal(route.calls.created, 1);
  assert.deepEqual(route.calls.effects, ["retrieve", "delete", "create"]);
});

// Loads the real registration and policy, not just an isolated helper export.
// Matching/dispatch is emulated; this is not Medusa HTTP-server acceptance.
function middlewareFixture(flag) {
  // Financial boundary behavior is covered separately. These registrations must
  // never execute while exercising the independent new-session pause policy.
  const unrelated = () => { throw new Error('Unexpected financial-route dispatch'); };
  const context = vm.createContext({ process: { env: { COMMERCE_PAYMENTS_ENABLED: flag } },
    guardNativePaymentRefund: unrelated, guardNativeOrderCancel: unrelated,
    guardFinancialWorkflow: unrelated, defineMiddlewares: (config) => config });
  if (existsSync(new URL(paths.policy, root))) load(source(paths.policy), context, paths.policy);
  if (existsSync(new URL(paths.middlewares, root))) load(source(paths.middlewares), context, paths.middlewares);
  const routes = context.middlewareConfig?.routes ?? [];
  const route = routes.find((entry) => entry.matcher === "/store/payment-collections/:id/payment-sessions"
    && (Array.isArray(entry.method) ? entry.method : [entry.method]).includes("POST"));
  return { routes, route };
}

for (const flag of ["false", "0", "off", " NO "]) {
  test(`registered direct new-session POST refuses pause=${flag}`, async () => {
    const { route } = middlewareFixture(flag);
    let downstream = 0;
    const res = response();
    const middlewares = route?.middlewares ?? [];
    const next = async (index = 0) => {
      if (!middlewares[index]) { downstream++; return; }
      await middlewares[index]({}, res, () => next(index + 1));
    };
    await next();
    assert.equal(downstream, 0, "registered middleware must prevent the creation handler");
    assert.equal(res.code, 503);
    assert.match(res.body.message, pausedMessage);
  });
}

test("direct new-session POST remains enabled by default and never gates paid/aftercare routes", async () => {
  const { routes, route } = middlewareFixture(undefined);
  assert.ok(route, "new-session middleware must be registered");
  let nextCalls = 0;
  await route.middlewares[0]({}, response(), () => nextCalls++);
  assert.equal(nextCalls, 1);
  // The payment-pause policy, not unrelated financial safety guards, remains
  // confined to provider-session creation and cannot block aftercare or reads.
  assert.equal(routes.filter(entry => entry.middlewares.includes(route.middlewares[0])).length, 1);
  assert.deepEqual(Array.from(route.method), ["POST"]);
});
