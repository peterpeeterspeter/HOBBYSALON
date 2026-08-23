import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for the P1-1 seller-link takeover fix (commit 70e3e595).
 *
 * Before the fix, isStaleAuthUser treated a transient auth-admin error as
 * "stale user", so linkUserToSeller would delete the existing owner's link
 * and hand the seller to whoever registered during an outage window.
 *
 * The fix fails closed: on lookup error it returns null and the caller must
 * abort without touching the existing link.
 *
 * The Supabase client is mocked at module level; shared test state lives in
 * a single mutable holder created inside vi.hoisted so the factory and the
 * tests see the same object.
 */

const h = vi.hoisted(() => {
  const state = {
    links: [] as Array<{
      id: string;
      user_id: string;
      seller_id: string;
      seller_type: string;
    }>,
    deletedIds: [] as string[],
    inserted: [] as Array<Record<string, unknown>>,
    getUserByIdResult:
      undefined as
        | { data: { user: unknown } | null; error: { message: string } | null }
        | undefined,
  };
  return state;
});

vi.mock("../client", () => ({
  createPlatformClient() {
    return {
      from(table: string) {
        if (table !== "user_seller_links") {
          throw new Error(`unexpected table ${table}`);
        }
        const filters: Array<[string, unknown]> = [];
        const apply = () =>
          h.links.filter((row) => filters.every(([c, v]) => row[c] === v));
        return {
          select() {
            return this;
          },
          eq(col: string, val: unknown) {
            filters.push([col, val]);
            return this;
          },
          async maybeSingle() {
            return { data: apply()[0] ?? null, error: null };
          },
          delete() {
            const doomed = apply();
            return {
              eq() {
                return {
                  async then(resolve: (v: { error: null }) => void) {
                    for (const row of doomed) h.deletedIds.push(String(row.id));
                    h.links = h.links.filter((r) => !doomed.includes(r));
                    resolve({ error: null });
                  },
                };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            return {
              async then(resolve: (v: { error: null }) => void) {
                h.inserted.push(payload);
                resolve({ error: null });
              },
            };
          },
        };
      },
      auth: {
        admin: {
          getUserById: async () => {
            if (!h.getUserByIdResult)
              throw new Error("getUserById not stubbed");
            return h.getUserByIdResult;
          },
        },
      },
    };
  },
}));

import { linkUserToSeller } from "./user-registration";

const SELLER = "seller-1";
function resetLinks(ownerUserId: string) {
  h.links = [
    {
      id: "link-owner",
      user_id: ownerUserId,
      seller_id: SELLER,
      seller_type: "merchant",
    },
  ];
  h.deletedIds = [];
  h.inserted = [];
}

describe("linkUserToSeller — P1-1 fail-closed stale auth", () => {
  beforeEach(() => resetLinks("owner-user"));

  it("transient auth lookup error fails closed — existing owner link untouched", async () => {
    h.getUserByIdResult = {
      data: null,
      error: { message: "503 backend error" },
    };

    const result = await linkUserToSeller("attacker-user", SELLER, "merchant");

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("niet verifiëren"))).toBe(true);
    expect(h.deletedIds).toEqual([]);
    expect(h.inserted).toEqual([]);
  });

  it("genuinely deleted auth user is still stale — link can be reclaimed", async () => {
    h.getUserByIdResult = { data: { user: null }, error: null };

    const result = await linkUserToSeller("new-user", SELLER, "merchant");

    expect(result.ok).toBe(true);
    expect(h.deletedIds).toContain("link-owner");
    expect(h.inserted).toEqual([
      { user_id: "new-user", seller_id: SELLER, seller_type: "merchant" },
    ]);
  });

  it("healthy competing owner blocks the claim exactly as before", async () => {
    h.getUserByIdResult = {
      data: { user: { id: "owner-user" } },
      error: null,
    };

    const result = await linkUserToSeller("attacker-user", SELLER, "merchant");

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("al gekoppeld"))).toBe(true);
    expect(h.deletedIds).toEqual([]);
    expect(h.inserted).toEqual([]);
  });
});
