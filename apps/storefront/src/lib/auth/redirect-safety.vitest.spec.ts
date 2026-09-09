import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ jar: new Map<string, string>(), set: vi.fn(), context: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => ({ value: mocks.jar.get(name) }), set: mocks.set,
}) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/platform/queries/user-registration", () => ({ getUserRegistrationContext: mocks.context }));
import { sanitizeNextPath, resolvePostAuthRedirectPath } from "./post-auth";
import { AUTH_NEXT_COOKIE, buildAuthConfirmUrl, consumeAuthNextPath, persistAuthNextPath, sanitizeAuthNextPath } from "./session";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.jar.clear();
  mocks.set.mockImplementation((name: string, value: string) => mocks.jar.set(name, value));
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.example");
});

describe("shared redirect policy at both auth boundaries", () => {
  const unsafe = [
    "/\\evil.example", "//evil.example", "https://evil.example", "\\evil.example",
    "/%5cevil.example", "/%2fevil.example", "/%255cevil.example", "/%252fevil.example",
    "/%25%35%63evil.example", "/ok\\evil", "/ok\npath", "/ok\rpath", "/ok\tpath", "/ok\u0000",
    "/ok%0apath", "/ok%0Dpath", "/ok%09path", "/ok%00path", "/ok%7fpath", "/ok%250apath",
    "/ok#%0aevil", "/ok?x=%5Cevil", "/bad%escape", "/.//evil.example", "/%2e%2e//evil.example",
  ];
  it.each(unsafe)("rejects unsafe or ambiguously encoded redirect %j in both paths", (path) => {
    expect(sanitizeNextPath(path, "/profile")).toBe("/profile");
    expect(sanitizeAuthNextPath(path)).toBeNull();
  });
  it.each([
    ["/cart", "/cart"],
    ["/shop/../cart?coupon=welkom#items", "/cart?coupon=welkom"],
    ["/zoeken?q=haak%20patroon&kleur=rood", "/zoeken?q=haak%20patroon&kleur=rood"],
    ["/patroon/café", "/patroon/caf%C3%A9"],
    ["/cart?next=%2Fprofile", "/cart?next=%2Fprofile"],
    ["/zoeken?q=100%25", "/zoeken?q=100%25"],
  ])("normalizes safe internal path %j without altering the query", (path, expected) => {
    expect(sanitizeNextPath(path, "/profile")).toBe(expected);
    expect(sanitizeAuthNextPath(path)).toBe(expected);
  });
  it("retains different existing whitespace and absent-path contracts", () => {
    expect(sanitizeNextPath(" /cart ", "/profile")).toBe("/cart");
    expect(sanitizeAuthNextPath(" /cart ")).toBeNull();
    expect(sanitizeNextPath(null, "")).toBe("");
    expect(sanitizeAuthNextPath(undefined)).toBeNull();
  });
  it("rejects controls before trimming", () => {
    expect(sanitizeNextPath("\n/cart", "/profile")).toBe("/profile");
    expect(sanitizeAuthNextPath("/cart\t")).toBeNull();
  });
  it("sanitizes fallback targets too while retaining the empty sentinel", async () => {
    expect(sanitizeNextPath(null, "//evil.example")).toBe("/profile");
    expect(sanitizeNextPath(null, "")).toBe("");
    expect(sanitizeNextPath(null, "/cart#items")).toBe("/cart");
    expect(await consumeAuthNextPath("/%5cevil.example")).toBe("/profile");
    expect(await resolvePostAuthRedirectPath({ userId: null, requestedNextPath: null, defaultPath: "//evil.example" })).toBe("/profile");
  });
  it("unsafe requested redirect still takes the ordinary role-based default", async () => {
    mocks.context.mockResolvedValue({ roles: ["merchant"], sellerLinks: [], preference: null });
    expect(await resolvePostAuthRedirectPath({ userId: "fixture", requestedNextPath: "/\\evil.example", defaultPath: "/profile" })).toBe("/dashboard");
    expect(mocks.context).toHaveBeenCalledTimes(1);
  });
  it("safe requested path retains priority over role-based defaults", async () => {
    expect(await resolvePostAuthRedirectPath({ userId: "fixture", requestedNextPath: "/cart?x=1#items", defaultPath: "/profile" })).toBe("/cart?x=1");
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it("preserves the session next-cookie lifetime and one-shot consumption", async () => {
    await persistAuthNextPath("/shop/../cart?x=1#items");
    expect(mocks.set).toHaveBeenCalledWith(AUTH_NEXT_COOKIE, "/cart?x=1", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 }));
    expect(await consumeAuthNextPath()).toBe("/cart?x=1");
    expect(mocks.set).toHaveBeenLastCalledWith(AUTH_NEXT_COOKIE, "", expect.objectContaining({ maxAge: 0 }));
    expect(await consumeAuthNextPath("/fallback")).toBe("/fallback");
    expect(buildAuthConfirmUrl("/cart?x=1#items")).toBe("https://site.example/auth/confirm");
  });
  it("clears unsafe persisted next paths and rejects legacy unsafe cookies", async () => {
    await persistAuthNextPath("/\\evil.example");
    expect(mocks.set).toHaveBeenLastCalledWith(AUTH_NEXT_COOKIE, "", expect.objectContaining({ maxAge: 0 }));
    mocks.jar.set(AUTH_NEXT_COOKIE, "/%255cevil.example");
    expect(await consumeAuthNextPath()).toBe("/profile");
  });
});
