// OFFLINE: real checkout actions, HMAC state, GET route, receipt producer and
// dispatcher; only Stripe, Supabase, Next request cookies and fetch are fakes.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ jar: new Map<string, string>(), set: vi.fn(), host: "www.hobbysalon.be",
  stripe: vi.fn(), from: vi.fn(), insert: vi.fn(), claimed: new Set<string>(), fetch: vi.fn(), failCookies: false, revokeOnClaim: false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => {
  const value = m.jar.get(key); return value === undefined ? undefined : { value };
}, set: m.set }), headers: async () => new Headers({ host: m.host }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: async () => ({ id: "private-user" }) }));
vi.mock("@/lib/platform/queries/creators", () => ({ getCreatorByUserId: async () => ({ id: "private-creator" }) }));
vi.mock("@/lib/platform/client", () => ({ createPlatformClient: () => ({ from: m.from }) }));
vi.mock("@/lib/payments/stripe-client", () => ({ getStripeClient: () => ({ checkout: { sessions: { create: m.stripe } } }) }));
import { createCreditPackCheckoutAction, createPlanCheckoutAction, createWorkshopListingCheckoutAction } from "@/app/actions/listing-checkout";
import { GET } from "@/app/api/analytics/platform-return/route";
import { POST } from "@/app/api/analytics/conversions/route";
import { rememberPlatformReturn } from "./platform-return.server";
import { CONVERSION_COOKIE, CONSENT_GENERATION_KEY, PLATFORM_RETURN_COOKIE, parseConversionReceipts } from "./conversions";
import { verifyConversion } from "./conversion-security.server";
import { clearAnalyticsCookies } from "./consent";
const generation = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const origin = "https://www.hobbysalon.be";
const request = (query = "kind=credit_pack&session_id=cs_test_actual", base = origin) => new Request(`${base}/api/analytics/platform-return?${query}`, { headers: { "sec-fetch-site": "cross-site" } });
const actions = [
  ["credit_pack", createCreditPackCheckoutAction, "pack_code"],
  ["plan", createPlanCheckoutAction, "plan_code"],
  ["workshop_listing", createWorkshopListingCheckoutAction, "workshop_id"],
] as const;
beforeEach(() => {
  vi.resetAllMocks(); m.jar.clear(); m.claimed.clear(); m.host = "www.hobbysalon.be"; m.failCookies = false; m.revokeOnClaim = false;
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "offline-signing-fixture-only");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "offline-public-key");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  m.jar.set("hs_posthog_consent_v1", "granted"); m.jar.set(CONSENT_GENERATION_KEY, generation);
  m.set.mockImplementation((key: string, value: string) => { if (m.failCookies) throw Error("cookie failure"); m.jar.set(key, value); });
  m.stripe.mockResolvedValue({ id: "cs_test_actual", url: "https://checkout.stripe.com/offline" });
  m.fetch.mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", m.fetch);
  m.from.mockImplementation((table: string) => {
    let id = "";
    const chain = { select: () => chain, eq: () => chain, insert: (row: { entity_id?: string; receipt_id?: string }) => {
      m.insert(table, row); id = `${table}:${row.entity_id ?? row.receipt_id}`; return chain;
    }, maybeSingle: async () => {
      if (table.startsWith("analytics_")) {
        if (m.revokeOnClaim) m.jar.set("hs_posthog_consent_v1", "denied");
        if (m.claimed.has(id)) return { data: null, error: { code: "23505" } };
        m.claimed.add(id); return { data: { entity_id: id, receipt_id: id }, error: null };
      }
      return { data: { id: generation, pack_code: "fixture", name: "Fixture", credits: 2, price_cents: 999,
        currency_code: "eur", code: "fixture", segment: "maker", billing_period: "yearly", title: "Private title", listing_fee_status: "unpaid" }, error: null };
    } };
    return chain;
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("platform return checkout integration", () => {
  it.each(actions)("%s creates signed, host-only state AFTER the actual Stripe response", async (kind, action, field) => {
    const form = new FormData(); form.set(field, generation);
    m.stripe.mockImplementationOnce(async () => {
      expect(m.jar.has(PLATFORM_RETURN_COOKIE)).toBe(false);
      return { id: "cs_test_actual", url: "https://checkout.stripe.com/offline" };
    });
    await expect(action(form)).rejects.toThrow("REDIRECT:https://checkout.stripe.com/offline");
    expect(m.stripe.mock.calls[0][0].success_url).toBe(`${origin}/api/analytics/platform-return?kind=${kind}&session_id={CHECKOUT_SESSION_ID}`);
    expect(m.set).toHaveBeenCalledWith(PLATFORM_RETURN_COOKIE, expect.any(String), { path: "/", secure: true, sameSite: "lax", httpOnly: false, maxAge: 1800 });
    const response = await GET(request(`kind=${kind}&session_id=cs_test_actual`));
    expect(response.status).toBe(303); expect(response.headers.get("location")).toContain("checkout=pending");
    expect(response.headers.get("location")).not.toContain("cs_test_actual");
    const receipts = parseConversionReceipts(m.jar.get(CONVERSION_COOKIE)!);
    expect(receipts).toHaveLength(1); expect(verifyConversion(receipts[0], generation)).toBe(true);
    expect(receipts[0].event).toBe("platform_charge_returned");
    expect(receipts[0].payload).toEqual({ charge_kind: kind });
    expect(m.insert.mock.calls[0][1]).toEqual({ event: "platform_charge_returned", entity_id: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it.each(actions)("%s survives cookie write failure without changing checkout", async (_kind, action, field) => {
    m.failCookies = true; const form = new FormData(); form.set(field, generation);
    await expect(action(form)).rejects.toThrow("REDIRECT:https://checkout.stripe.com/offline");
    expect(m.jar.has(PLATFORM_RETURN_COOKIE)).toBe(false);
  });
  it.each(["denied", "pending"])("creates no state or claim for %s consent", async (consent) => {
    m.jar.set("hs_posthog_consent_v1", consent);
    const form = new FormData(); form.set("pack_code", "fixture");
    await expect(createCreditPackCheckoutAction(form)).rejects.toThrow("REDIRECT:https://checkout.stripe.com/offline");
    await GET(request()); expect(m.jar.has(PLATFORM_RETURN_COOKIE)).toBe(false); expect(m.insert).not.toHaveBeenCalled();
  });
});

describe("real signed return security", () => {
  it("rejects a modified payload retaining a real signature", async () => {
    await rememberPlatformReturn("credit_pack", "cs_test_actual");
    const [body, signature] = m.jar.get(PLATFORM_RETURN_COOKIE)!.split(".");
    const state = JSON.parse(Buffer.from(body, "base64url").toString()); state.sessionId = "cs_forged";
    m.jar.set(PLATFORM_RETURN_COOKIE, `${Buffer.from(JSON.stringify(state)).toString("base64url")}.${signature}`);
    await GET(request("kind=credit_pack&session_id=cs_forged"));
    expect(m.insert).not.toHaveBeenCalled(); expect(m.jar.has(CONVERSION_COOKIE)).toBe(false);
  });
  it("returns to the dashboard after a DB failure without retry", async () => {
    await rememberPlatformReturn("credit_pack", "cs_test_actual");
    m.from.mockImplementationOnce(() => { throw Error("offline DB failure"); });
    const result = await GET(request()); expect(result.status).toBe(303);
    expect(m.from).toHaveBeenCalledTimes(1); expect(m.jar.has(CONVERSION_COOKIE)).toBe(false);
  });
  it("fails closed without a signing key and ignores unsafe producer hosts", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await rememberPlatformReturn("credit_pack", "cs_test_actual");
    expect(m.jar.has(PLATFORM_RETURN_COOKIE)).toBe(false);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "offline-signing-fixture-only"); m.host = "evil.test";
    await rememberPlatformReturn("credit_pack", "cs_test_actual");
    expect(m.jar.has(PLATFORM_RETURN_COOKIE)).toBe(false);
  });
  it("requires current consent at downstream receipt consumption too", async () => {
    await rememberPlatformReturn("credit_pack", "cs_test_actual"); await GET(request());
    const raw = m.jar.get(CONVERSION_COOKIE)!; m.insert.mockClear();
    m.jar.set("hs_posthog_consent_v1", "denied");
    await POST(new Request(`${origin}/api/analytics/conversions`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: raw }));
    expect(m.insert).not.toHaveBeenCalled(); expect(m.fetch).not.toHaveBeenCalled();
  });
  it.each(["forged", "binding", "kind", "crosshost", "evilhost", "http", "expiry", "generation", "denied", "missing", "duplicate"])("rejects %s before any DB claim", async (failure) => {
    await rememberPlatformReturn("credit_pack", "cs_test_actual");
    let req = request();
    if (failure === "forged") m.jar.set(PLATFORM_RETURN_COOKIE, m.jar.get(PLATFORM_RETURN_COOKIE)!.replace(/.$/, "z"));
    if (failure === "binding") req = request("kind=credit_pack&session_id=cs_other");
    if (failure === "kind") req = request("kind=plan&session_id=cs_test_actual");
    if (failure === "crosshost") req = request(undefined, "https://www.hobbysalon.nl");
    if (failure === "evilhost") req = request(undefined, "https://www.hobbysalon.be.evil.test");
    if (failure === "http") req = request(undefined, "http://www.hobbysalon.be");
    if (failure === "expiry") { vi.useFakeTimers(); vi.setSystemTime(Date.now() + 1800_001); }
    if (failure === "generation") m.jar.set(CONSENT_GENERATION_KEY, "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
    if (failure === "denied") m.jar.set("hs_posthog_consent_v1", "denied");
    if (failure === "missing") m.jar.delete(PLATFORM_RETURN_COOKIE);
    if (failure === "duplicate") req = request("kind=credit_pack&session_id=cs_test_actual&session_id=cs_other");
    const result = await GET(req); expect(result.status).toBe(303);
    expect(m.insert).not.toHaveBeenCalled(); expect(m.jar.has(CONVERSION_COOKIE)).toBe(false);
    expect(result.headers.get("location")).toMatch(/^https:\/\/(www\.)?hobbysalon\.(be|nl)\/dashboard/);
  });
  it("claims a nonce at most once even when the old signed cookie is replayed", async () => {
    await rememberPlatformReturn("credit_pack", "cs_test_actual"); const raw = m.jar.get(PLATFORM_RETURN_COOKIE)!;
    await GET(request()); const receipt = m.jar.get(CONVERSION_COOKIE);
    m.jar.set(PLATFORM_RETURN_COOKIE, raw); await GET(request());
    expect(m.jar.get(CONVERSION_COOKIE)).toBe(receipt);
    expect(m.insert).toHaveBeenCalledTimes(2); expect(m.claimed.size).toBe(1);
  });
  it("checks current consent again after claim and never queues on withdrawal", async () => {
    await rememberPlatformReturn("credit_pack", "cs_test_actual"); m.revokeOnClaim = true;
    await GET(request()); expect(m.insert).toHaveBeenCalledTimes(1); expect(m.jar.has(CONVERSION_COOKIE)).toBe(false);
  });
  it("does not retry receipt delivery after a cookie failure", async () => {
    await rememberPlatformReturn("credit_pack", "cs_test_actual"); const raw = m.jar.get(PLATFORM_RETURN_COOKIE)!;
    m.set.mockImplementation((key: string, value: string) => { if (key === CONVERSION_COOKIE) throw Error("failure"); m.jar.set(key, value); });
    await GET(request()); m.jar.set(PLATFORM_RETURN_COOKIE, raw); await GET(request());
    expect(m.claimed.size).toBe(1); expect(m.jar.has(CONVERSION_COOKIE)).toBe(false);
  });
  it("withdrawal clears the readable pending cookie", () => {
    const writes: string[] = []; const doc = { get cookie() { return `${PLATFORM_RETURN_COOKIE}=signed`; }, set cookie(value: string) { writes.push(value); } };
    vi.stubGlobal("window", { location: new URL(`${origin}/dashboard`) }); vi.stubGlobal("document", doc);
    clearAnalyticsCookies(); expect(writes).toContain(`${PLATFORM_RETURN_COOKIE}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`);
  });
  it("delivers only charge_kind plus anonymous technical properties; never purchase/private context; no retry", async () => {
    await rememberPlatformReturn("credit_pack", "cs_test_actual"); await GET(request());
    const raw = m.jar.get(CONVERSION_COOKIE)!;
    const post = () => POST(new Request(`${origin}/api/analytics/conversions`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: raw }));
    await post(); await post(); expect(m.fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(m.fetch.mock.calls[0][1].body);
    expect(payload.event).toBe("platform_charge_returned");
    expect(payload.properties).toEqual({ charge_kind: "credit_pack", site_country: "BE", $process_person_profile: false, $geoip_disable: true, $ip: "0.0.0.0" });
    expect(JSON.stringify(payload)).not.toMatch(/cs_test|private-|dashboard|session_id|generation|purchase|page_location|\$current_url/);
    expect(payload.distinct_id).not.toBe(generation);
  });
});
