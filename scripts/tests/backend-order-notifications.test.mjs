import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes, createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

// Offline only: actual subscribers and templates, no app startup, database or mail.
// node --experimental-vm-modules --test scripts/tests/backend-order-notifications.test.mjs
const root = new URL("../../", import.meta.url);
const base = "packages/modules/resend/src/";
const require = createRequire(import.meta.url);
// Prefer project-installed dependencies. External tooling can be supplied explicitly;
// this runner never installs packages or imports the live notification service.
function resolveDependency(specifier, overrideName) {
  try {
    return require.resolve(process.env[overrideName] || specifier);
  } catch (cause) {
    throw new Error(`Cannot resolve ${specifier}; install the project dependencies or set ${overrideName} to an existing module path.`, { cause });
  }
}
const ts = require(resolveDependency("typescript", "NOTIFICATION_TEST_TYPESCRIPT"));
const nativePath = resolveDependency(
  "@medusajs/notification/dist/services/notification-module-service.js", "NOTIFICATION_TEST_NATIVE");
const templateNames = { buyer: "BuyerNewOrderEmailTemplate", seller: "SellerNewOrderEmailTemplate" };
const templateKeys = { buyer: "buyerNewOrderEmailTemplate", seller: "sellerNewOrderEmailTemplate" };

function order(id = "order-1", overrides = {}) {
  return { id, display_id: 12, email: "buyer@example.invalid", currency_code: "eur",
    customer: { first_name: "Test", last_name: "Customer" },
    seller: { id: "seller-1", name: "Test shop", email: "seller@example.invalid" },
    order_set: { id: "set-1" }, created_at: new Date("2026-10-04T08:00:00Z"),
    summary: { current_order_total: 15 }, items: [{ id: "item-1", product_title: "Test product", unit_price: 10, quantity: 1 }],
    shipping_methods: [{ amount: 5, name: "Delivery" }],
    shipping_address: { first_name: "Test", last_name: "Customer", address_1: "Test street", postal_code: "1000", city: "Test city" },
    ...overrides };
}
function template(role) {
  const fileName = role === "payout" ? "seller-payout-summary" : `${role}-new-order`;
  const file = new URL(`${base}providers/resend/email-templates/${fileName}.tsx`, root);
  const js = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file.pathname,
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  // Payout regression checks real static HTML, not only a synthetic JSX tree.
  const nativeRequire = createRequire(nativePath);
  const React = role === "payout" ? nativeRequire("react") :
    { createElement: (tag, props, ...children) => ({ tag, props, children }) };
  const context = vm.createContext({ exports, React, Date });
  vm.runInContext(js, context);
  return exports[role === "payout" ? "SellerPayoutSummaryEmailTemplate" : templateNames[role]];
}
const payoutISO = "2026-10-04T08:00:00.000Z";
for (const [label, date, expected, serialized] of [
  ["valid Date unchanged", new Date(payoutISO), payoutISO, false],
  ["Date after JSON round trip", new Date(payoutISO), payoutISO, true],
  ["serialized ISO", payoutISO, payoutISO, true],
  ["null", null, "—", true],
  ["missing", undefined, "—", true],
  ["invalid string", "invalid-date", "—", true],
  ["empty string", "", "—", true],
  ["invalid Date", new Date(NaN), "—", false],
]) {
  test(`payout: actual rendered template handles ${label} without epoch fallback`, () => {
    const payload = { data: { seller: { email: "seller@example.invalid", name: "Test shop" },
      payouts: [{ id: "payout-1", created_at: date, amount: 15, currency_code: "eur",
        order: { id: "order-1", display_id: 12, created_at: date } }],
      store_name: "Test shop", storefront_url: "https://store.example.invalid" } };
    const input = serialized ? JSON.parse(JSON.stringify(payload)) : payload;
    const { renderToStaticMarkup } = createRequire(nativePath)("react-dom/server");
    const html = renderToStaticMarkup(template("payout")(input));
    const cells = [...html.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
    assert.equal(cells.length, 3);
    assert.equal(cells[2][1], expected);
    assert.ok(html.includes("You have received new transfers to your Stripe account!"));
    assert.ok(html.includes("Order #12"));
    assert.ok(!html.includes("1970-01-01") && !html.includes("Invalid Date"));
    if (!serialized && date instanceof Date && Number.isFinite(date.getTime())) {
      assert.equal(date.toISOString(), payoutISO);
    }
  });
}
async function harness(role, options = {}) {
  const calls = [], logs = [], queried = [];
  const render = template(role);
  const context = vm.createContext({ console: { error: (...args) => logs.push(args) } });
  const dependencies = {
    "@medusajs/framework": { SubscriberArgs: undefined, SubscriberConfig: undefined },
    "@medusajs/framework/utils": { Modules: { NOTIFICATION: "notification" }, ContainerRegistrationKeys: { QUERY: "query" }, OrderWorkflowEvents: { PLACED: "order.placed" } },
    "../providers/resend": { ResendNotificationTemplates: { BUYER_NEW_ORDER: templateKeys.buyer, SELLER_NEW_ORDER: templateKeys.seller } },
    "@mercurjs/framework": { Hosts: { STOREFRONT: "storefront" },
      buildHostAddress: (_, path) => new URL(path, "https://store.example.invalid"),
      fetchStoreData: async () => { if (options.storeFailure) throw options.storeFailure; return { store_name: "Test shop", storefront_url: "https://store.example.invalid" }; } },
  };
  const source = stripTypeScriptTypes(readFileSync(new URL(`${base}subscribers/notification-${role}-new-order.ts`, root), "utf8"));
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => {
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected dependency: ${specifier}`);
    const values = dependencies[specifier];
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  const container = { resolve(key) {
    if (key === "query") return { graph: async ({ filters }) => {
      queried.push(filters.id);
      if (options.queryFailure === filters.id) throw new Error("query unavailable");
      return { data: options.missingOrder === filters.id ? [] : [order(filters.id, options.overrides)] };
    } };
    if (key === "notification" && options.notificationService) return options.notificationService;
    assert.equal(key, "notification");
    return { createNotifications: async (input) => {
      for (const notification of Array.isArray(input) ? input : [input]) {
        calls.push(notification);
        if (options.dispatchFailure === notification.data.data.order_id) throw new Error("dispatch unavailable");
        // Notification payloads cross a serialization boundary before rendering.
        render(JSON.parse(JSON.stringify(notification.data)));
      }
    } };
  } };
  return { calls, logs, queried, run: (ids = ["order-1"]) => module.namespace.default({ event: { data: { order_ids: ids } }, container }), config: module.namespace.config };
}
for (const role of ["buyer", "seller"]) {
  test(`${role}: graph failure reaches subscriber caller after remaining orders`, async () => {
    const h = await harness(role, { queryFailure: "order-1" });
    await assert.rejects(h.run(["order-1", "order-2"]), /notification|query unavailable/i);
    assert.deepEqual(h.queried, ["order-1", "order-2"]);
    assert.equal(h.calls.length, 1);
    assert.equal(h.logs.length, 1);
  });
  test(`${role}: dispatch failure reaches subscriber retry`, async () => {
    const h = await harness(role, { dispatchFailure: "order-1" });
    await assert.rejects(h.run(), /notification|dispatch unavailable/i);
    assert.equal(h.logs.length, 1);
  });
  test(`${role}: missing order is retryable, not silent success`, async () => {
    const h = await harness(role, { missingOrder: "order-1" });
    await assert.rejects(h.run(), /notification|not found/i);
    assert.equal(h.calls.length, 0);
  });
  test(`${role}: shared store-data failure already propagates`, async () => {
    const h = await harness(role, { storeFailure: new Error("store unavailable") });
    await assert.rejects(h.run(), /store unavailable/);
    assert.equal(h.calls.length, 0);
  });
  for (const date of [new Date("2026-10-04T08:00:00Z"), "2026-10-04T08:00:00.000Z", null, "invalid-date"]) {
    test(`${role}: actual template renders JSON payload with date ${String(date)}`, async () => {
      const h = await harness(role, { overrides: { created_at: date } });
      await h.run();
      assert.equal(h.calls.length, 1);
      assert.equal(h.logs.length, 0);
      assert.equal(h.calls[0].template, templateKeys[role]);
      assert.equal(h.config.event, "order.placed");
    });
  }
}
for (const order_set of [undefined, null, {}, { id: "set-1" }]) {
  test(`buyer: keeps account/orders link with order_set ${JSON.stringify(order_set)}`, async () => {
    const h = await harness("buyer", { overrides: { order_set } });
    await h.run();
    assert.equal(h.calls.length, 1);
    assert.equal(h.logs.length, 0);
    assert.equal(h.calls[0].data.data.order_address, `https://store.example.invalid/account/orders/${order_set?.id ?? "order-1"}`);
  });
}
test("seller: missing seller email is retryable", async () => {
  const h = await harness("seller", { overrides: { seller: null } });
  await assert.rejects(h.run(), /notification|email/i);
  assert.equal(h.calls.length, 0);
});

// Execute the installed 2.11.3 notification algorithm with repository/provider
// stubs, rather than inventing idempotency semantics. No real DB or provider.
function nativeNotificationService(role) {
  const path = nativePath;
  const exports = {};
  let serial = 0, fail = true;
  const records = [], sends = [];
  const utils = {
    MedusaService: () => class {}, generateEntityId: () => `noti-${++serial}`,
    NotificationStatus: { FAILURE: "failure", SUCCESS: "success" },
    MedusaError: class extends Error { static Types = { NOT_FOUND: "not_found", UNEXPECTED_STATE: "unexpected_state" }; constructor(_, message) { super(message); } },
    promiseAll: async (promises) => { const results = await Promise.allSettled(promises); const failures = results.filter((r) => r.status === "rejected"); if (failures.length) throw new AggregateError(failures.map((r) => r.reason), "dispatch failed"); return results.map((r) => r.value); },
    InjectManager: () => () => {}, EmitEvents: () => () => {}, MedusaContext: () => () => {},
  };
  const context = vm.createContext({ exports, require: (specifier) => {
    if (specifier === "@medusajs/framework/utils") return utils;
    assert.equal(specifier, "../models"); return { Notification: {} };
  } });
  vm.runInContext(readFileSync(path, "utf8"), context);
  const provider = { id: "offline", channels: ["email"], is_enabled: true };
  const render = template(role);
  const service = new exports.default({
    baseRepository: { transaction: async (fn) => fn({}), serialize: async (rows) => rows },
    notificationService: {
      list: async ({ idempotency_key }) => records.filter((r) => idempotency_key.includes(r.idempotency_key)),
      create: async (rows) => { records.push(...rows.map((r) => ({ ...r, status: "pending" }))); return rows; },
      update: async (rows) => rows.map((r) => { const existing = records.find((e) => e.id === r.id); if (existing) Object.assign(existing, r); return r; }),
    },
    notificationProviderService: {
      getProviderForChannels: async () => [provider],
      send: async (_, notification) => {
        sends.push(notification.data.data.order_id);
        if (fail && notification.data.data.order_id === "order-2") { fail = false; throw new Error("offline dispatch failure"); }
        render(JSON.parse(JSON.stringify(notification.data)));
        return { id: "offline-receipt" };
      },
    },
  }, {});
  return { service, sends };
}
for (const role of ["buyer", "seller"]) {
  test(`${role}: native idempotency skips successful order on same event retry`, async () => {
    const native = nativeNotificationService(role);
    const h = await harness(role, { notificationService: native.service });
    await assert.rejects(h.run(["order-1", "order-2"]));
    await h.run(["order-1", "order-2"]);
    assert.deepEqual(native.sends, ["order-1", "order-2", "order-2"]);
  });
}
