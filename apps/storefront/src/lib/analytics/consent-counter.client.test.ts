import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

async function browser(t: TestContext) {
  const requests: { url: string; body: Blob | string; options?: RequestInit }[] = [];
  const globals = {
    window: {},
    navigator: {
      sendBeacon: (url: string, body: Blob): boolean => {
        requests.push({ url, body });
        return true;
      },
    },
    fetch: async (url: string, options: RequestInit): Promise<Response> => {
      requests.push({ url, body: String(options.body), options });
      return new Response(null, { status: 204 });
    },
  };
  for (const [name, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => previous
      ? Object.defineProperty(globalThis, name, previous)
      : Reflect.deleteProperty(globalThis, name));
  }
  // Each fresh module represents a separate document lifetime.
  const { countConsentPageview: count } = await import(
    new URL(`./consent-counter.ts?document=${crypto.randomUUID()}`, import.meta.url).href
  );
  const payloads = async () => Promise.all(requests.map(async ({ body }) =>
    JSON.parse(typeof body === "string" ? body : await body.text())
  ));
  return { count, requests, payloads, navigator: globals.navigator };
}

test("consent changes and effect replays do not create another pageview", async (t) => {
  const f = await browser(t);
  f.count("/workshops", "denied");
  f.count("/workshops", "denied");
  f.count("/workshops", "granted");
  f.count("/workshops", "denied");
  assert.deepEqual(await f.payloads(), [{ path: "/workshops", consent: "denied" }]);
});

test("returning to a previous route counts a new view with its current consent", async (t) => {
  const f = await browser(t);
  f.count("/workshops", "denied");
  f.count("/artikelen", "granted");
  f.count("/workshops", "granted");
  f.count("/artikelen", "granted");
  assert.deepEqual(await f.payloads(), [
    { path: "/workshops", consent: "denied" },
    { path: "/artikelen", consent: "granted" },
    { path: "/workshops", consent: "granted" },
    { path: "/artikelen", consent: "granted" },
  ]);
});

test("detail visits remain distinct but only their template enters the request body", async (t) => {
  const f = await browser(t);
  f.count("/creator/jane-doe", "granted");
  f.count("/creator/john-doe", "granted");
  f.count("/creator/jane-doe", "granted");
  assert.deepEqual(await f.payloads(), Array.from({ length: 3 }, () => ({
    path: "/creator/detail", consent: "granted",
  })));
});

test("private routes send nothing and do not swallow the next public revisit", async (t) => {
  const f = await browser(t);
  f.count("/workshops", "denied");
  f.count("/dashboard/private-person", "denied");
  f.count("/workshops", "denied");
  assert.deepEqual(await f.payloads(), [
    { path: "/workshops", consent: "denied" },
    { path: "/workshops", consent: "denied" },
  ]);
});

test("query, fragment and trailing slash changes do not create extra views", async (t) => {
  const f = await browser(t);
  f.count("/zoeken?q=private#token", "denied");
  f.count("/zoeken?q=other", "denied");
  f.count("/zoeken/", "denied");
  assert.deepEqual(await f.payloads(), [{ path: "/zoeken", consent: "denied" }]);
});

test("a beacon rejected by the browser falls back to a single keepalive fetch", async (t) => {
  const f = await browser(t);
  f.navigator.sendBeacon = () => false;
  f.count("/workshops", "granted");
  f.count("/workshops", "denied");
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, "/api/analytics/pageview");
  assert.equal(f.requests[0].options?.method, "POST");
  assert.equal(f.requests[0].options?.keepalive, true);
  assert.deepEqual(f.requests[0].options?.headers, { "content-type": "application/json" });
  assert.equal(typeof f.requests[0].body, "string");
  assert.deepEqual(await f.payloads(), [{ path: "/workshops", consent: "granted" }]);
});

test("transport errors do not break navigation or retry on consent changes", async (t) => {
  const f = await browser(t);
  let attempts = 0;
  f.navigator.sendBeacon = () => { attempts++; throw new Error("blocked"); };
  assert.doesNotThrow(() => f.count("/workshops", "denied"));
  assert.doesNotThrow(() => f.count("/workshops", "granted"));
  assert.equal(attempts, 1);
  assert.doesNotThrow(() => f.count("/artikelen", "granted"));
  assert.equal(attempts, 2);
});

test("a new document counts the same route again", async (t) => {
  const first = await browser(t);
  first.count("/", "granted");
  assert.equal(first.requests.length, 1);
  const second = await browser(t);
  second.count("/", "granted");
  assert.equal(second.requests.length, 1);
});
