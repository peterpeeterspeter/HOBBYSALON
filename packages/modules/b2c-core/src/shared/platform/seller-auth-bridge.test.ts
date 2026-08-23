import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for the seller-auth exchange bridge (commit 70e3e595).
 *
 * P1-2: the exchange used to fall back to the oldest member of a seller when
 * no member matched the Supabase user's email, letting any linked user act as
 * an arbitrary (typically owner) member. The fix requires an exact
 * case-insensitive email match and fails with NOT_FOUND otherwise.
 *
 * All external dependencies (knex connection, Supabase REST client, access
 * token verification, auth identity linking) are stubbed via vi.mock with
 * hoisting-safe state containers.
 */

// Hoisted mutable state shared with vi.mock factories (factories run before
// module-level const declarations, so state must live on this holder).
const h = vi.hoisted(() => {
  return {
    linksByUser: {} as Record<
      string,
      Array<{ seller_id: string; seller_type: string }>
    >,
    usersByToken: {} as Record<string, { id: string; email: string }>,
    memberFirstResult: undefined as
      | { id: string; seller_id: string; email: string; name: string }
      | undefined,
    memberOrderedFirstResult: undefined as
      | { id: string; seller_id: string; email: string; name: string }
      | undefined,
    sellerRow: {
      id: "seller-1111",
      email: "store@example.com",
      store_status: "active",
    } as { id: string; email: string; store_status: string } | undefined,
    plainMemberCalls: 0,
    orderedMemberCalls: 0,
  };
});

vi.mock("./supabase-rest-client", () => ({
  escapePostgrestValue: (v: string) => v,
  createPlatformSupabaseClient: () => ({
    get: async (_table: string, query: Record<string, string>) => {
      const match = /eq\.(.+)/.exec(query.user_id ?? "");
      const userId = decodeURIComponent(match?.[1] ?? "");
      return h.linksByUser[userId] ?? [];
    },
  }),
}));

vi.mock("./supabase-auth", () => ({
  verifySupabaseAccessToken: async (token: string) =>
    h.usersByToken[token] ?? null,
}));

vi.mock("@medusajs/workflows-sdk", () => ({
  createWorkflow: () => () => ({ run: async () => ({ linked: true }) }),
  WorkflowResponse: class {},
}));

import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { StoreStatus } from "@mercurjs/framework";
import { exchangePlatformSellerAuth } from "./seller-auth-bridge";

const SELLER_ID = "seller-1111";
const OWNER_MEMBER_ID = "member-owner";

function makeContainer() {
  return {
    resolve: (key: unknown) => {
      if (key === ContainerRegistrationKeys.PG_CONNECTION) {
        const knexTable = (table: string) => {
          if (table === "seller") {
            // seller query: .select().where("id",…).whereNull("deleted_at").first()
            return {
              select: () => ({
                where: () => ({
                  whereNull: () => ({
                    first: () => Promise.resolve(h.sellerRow),
                  }),
                }),
              }),
            };
          }
          if (table === "member") {
            // member query: .select().where("seller_id",…).whereRaw(lower(email)…).whereNull("deleted_at").first()
            return {
              select: () => ({
                where: () => ({
                  whereRaw: () => ({
                    whereNull: () => ({
                      first() {
                        h.plainMemberCalls += 1;
                        return Promise.resolve(h.memberFirstResult);
                      },
                      orderBy() {
                        return {
                          first() {
                            // The removed fallback path: selecting the oldest
                            // member without an email filter.
                            h.orderedMemberCalls += 1;
                            return Promise.resolve(h.memberOrderedFirstResult);
                          },
                        };
                      },
                    }),
                  }),
                }),
              }),
            };
          }
          throw new Error(`unexpected table ${table}`);
        };
        return knexTable;
      }
      if (key === ContainerRegistrationKeys.CONFIG_MODULE) {
        return { projectConfig: { http: { jwtSecret: "test-secret" } } };
      }
      if (key === ContainerRegistrationKeys.QUERY) {
        return {
          graph: async () => ({
            data: [
              {
                id: "auth-identity-1",
                app_metadata: { seller_id: OWNER_MEMBER_ID },
              },
            ],
          }),
        };
      }
      if (key === Modules.AUTH) {
        // findAuthIdentityByEmail already returns a matching identity, so
        // register() should never be reached; fail loudly if it is.
        return {
          register: async () => {
            throw new Error(
              "unexpected authService.register: identity lookup should have matched"
            );
          },
        };
      }
      throw new Error(`unexpected container.resolve(${String(key)})`);
    },
  } as never;
}

describe("exchangePlatformSellerAuth — P1-2 exact email match", () => {
  beforeEach(() => {
    h.plainMemberCalls = 0;
    h.orderedMemberCalls = 0;
    h.memberFirstResult = undefined;
    h.memberOrderedFirstResult = undefined;
    h.sellerRow = {
      id: SELLER_ID,
      email: "store@example.com",
      store_status: StoreStatus.ACTIVE,
    };
    for (const k of Object.keys(h.linksByUser)) delete h.linksByUser[k];
    for (const k of Object.keys(h.usersByToken)) delete h.usersByToken[k];
    h.linksByUser["user-victim"] = [
      { seller_id: SELLER_ID, seller_type: "merchant" },
    ];
    h.usersByToken["token-valid"] = {
      id: "user-victim",
      email: "owner@example.com",
    };
  });

  it("issues a JWT when a member with the exact (lowercased) email exists", async () => {
    h.memberFirstResult = {
      id: OWNER_MEMBER_ID,
      seller_id: SELLER_ID,
      email: "OWNER@Example.com",
      name: "Owner",
    };

    const result = await exchangePlatformSellerAuth(
      makeContainer(),
      "token-valid"
    );

    expect(result.member_id).toBe(OWNER_MEMBER_ID);
    expect(result.seller_id).toBe(SELLER_ID);
    expect(result.token).toEqual(expect.any(String));
    expect(h.orderedMemberCalls).toBe(0);
  });

  it("throws NOT_FOUND instead of falling back to the oldest member on email mismatch", async () => {
    // No member matches the Supabase email…
    h.memberFirstResult = undefined;
    // …but an oldest-member fallback target exists (the old exploit path).
    h.memberOrderedFirstResult = {
      id: "member-owner",
      seller_id: SELLER_ID,
      email: "owner-real@example.com",
      name: "Owner",
    };

    let caught: unknown;
    try {
      await exchangePlatformSellerAuth(makeContainer(), "token-valid");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MedusaError);
    expect((caught as { type?: string }).type).toBe("not_found");
    expect((caught as Error).message).toBe("No seller member found for this account.");
    // Critical regression assertion: the fallback query must never run.
    expect(h.orderedMemberCalls).toBe(0);
    expect(h.plainMemberCalls).toBe(1);
  });

  it("still refuses inactive stores regardless of email match", async () => {
    h.sellerRow = {
      id: SELLER_ID,
      email: "store@example.com",
      store_status: "suspended",
    };

    await expect(
      exchangePlatformSellerAuth(makeContainer(), "token-valid")
    ).rejects.toMatchObject({ type: "not_allowed" });
  });

  it("rejects invalid Supabase tokens outright", async () => {
    await expect(
      exchangePlatformSellerAuth(makeContainer(), "token-bogus")
    ).rejects.toMatchObject({ type: "unauthorized" });
  });
});
