import assert from "node:assert/strict";
import type { TestContext } from "node:test";

// Test-only browser and SDK boundary. No real SDK initialization or HTTP calls.
export function browser(t: TestContext, options: { host?: string; path?: string; consent?: string; installed?: boolean; ready?: boolean } = {}) {
  const values = new Map<string, string>();
  const cookies = new Map<string, string>();
  const cookieWrites: string[] = [];
  const calls: unknown[][] = [];
  const lifecycle: string[] = [];
  const initializations: Array<{ token: string; config: Record<string, unknown> }> = [];
  const events: Event[] = [];
  const target = new EventTarget();
  if (options.consent) {
    values.set("hs_posthog_consent_v1", options.consent);
    cookies.set("hs_posthog_consent_v1", options.consent);
  }
  const sdk = {
    capture: (...args: unknown[]) => { calls.push(args); },
    opt_in_capturing: () => { lifecycle.push("opt_in"); },
    opt_out_capturing: () => { lifecycle.push("opt_out"); },
    reset: (resetDeviceId?: boolean) => { lifecycle.push(`reset:${String(resetDeviceId)}`); },
    init: (token: string, config: Record<string, unknown>) => { initializations.push({ token, config }); },
  };
  const window = {
    location: new URL(`https://${options.host ?? "hobbysalon.nl"}${options.path ?? "/workshops?email=private#token"}`),
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
    hsPostHog: options.installed === false ? undefined : sdk,
    hsPostHogReady: options.ready ?? false,
    hsPostHogConsent: undefined as boolean | undefined,
    hsPostHogLastPage: undefined as string | undefined,
    hsPostHogLoading: undefined as Promise<void> | undefined,
    hsPostHogLoadFailed: undefined as boolean | undefined,
    hsConsentBlocked: undefined as boolean | undefined,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: (event: Event) => { events.push(event); return target.dispatchEvent(event); },
  };
  const document = { referrer: "https://source.example/private?token=secret", title: "Private Person", cookie: "" };
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
    set: (raw: string) => {
      cookieWrites.push(raw);
      const pair = raw.split(";", 1)[0];
      const index = pair.indexOf("=");
      const key = pair.slice(0, index), value = pair.slice(index + 1);
      if (/(?:^|;)\s*Max-Age=0(?:;|$)/.test(raw)) cookies.delete(key);
      else cookies.set(key, value);
    },
  });
  for (const [key, value] of Object.entries({ window, document })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : Reflect.deleteProperty(globalThis, key));
  }
  const fetch = t.mock.method(globalThis, "fetch", async () => { assert.fail("unit test attempted a real HTTP request"); });
  t.after(() => assert.equal(fetch.mock.callCount(), 0, "SDK-boundary fixtures must not initiate HTTP requests"));
  return {
    window, document, values, cookies, cookieWrites, calls, lifecycle, sdk, initializations, events,
    views: () => calls.filter(([event]) => event === "$pageview"),
    ready: () => { window.hsPostHogReady = true; window.dispatchEvent(new Event("hs:posthog_ready")); },
  };
}

export function environment(t: TestContext, overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    const previous = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

export function safeProperties(call: unknown[]) {
  assert.equal(call.length, 2, "capture receives only an event name and the safe envelope");
  assert.deepEqual(Object.keys(call[1] as object), ["hs_safe"]);
  return (call[1] as { hs_safe: Record<string, unknown> }).hs_safe;
}
