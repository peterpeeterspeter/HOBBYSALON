import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for the P1-3 spotlight boost fix (commit 70e3e595).
 *
 * Before the fix:
 *  - purchaseSpotlightBoostAction never verified that the boosted entity
 *    belongs to the paying creator → cross-creator boosts with own credits.
 *  - if createVisibilityBoost failed after consumeCredits succeeded, credits
 *    were silently lost (no refund path).
 *
 * The fix adds an ownership assertion before deducting and a compensating
 * refund when the boost insert fails.
 *
 * Mocks: @/lib/platform/client (query chains per table), ./listing-credits
 * (consumeCredits/addCredits), ./ranking (createVisibilityBoost).
 */

const h = vi.hoisted(() => {
  const state = {
    /** Rows by table name; each row is a full record. */
    tables: {} as Record<string, Array<Record<string, unknown>>>,
    selectError: null as { message: string } | null,
    consumedCalls: [] as Array<{
      creatorId: string;
      amount: number;
      reason: string;
    }>,
    refundCalls: [] as Array<{ creatorId: string; amount: number; reason: string }>,
    boostResult: { ok: true, id: "boost-1" } as {
      ok: boolean;
      id?: string;
      error?: string;
    },
    boostCalls: [] as Array<{ entityType: string; entityId: string }>,
  };
  return state;
});

vi.mock("@/lib/platform/client", () => ({
  createPlatformClient() {
    return {
      from(table: string) {
        const rows = h.tables[table] ?? [];
        const filters: Array<[string, unknown]> = [];
        const apply = () =>
          rows.filter((row) => filters.every(([c, v]) => row[c] === v));
        return {
          select() {
            return this;
          },
          eq(col: string, val: unknown) {
            filters.push([col, val]);
            return this;
          },
          async maybeSingle() {
            if (h.selectError) return { data: null, error: h.selectError };
            return { data: apply()[0] ?? null, error: null };
          },
        };
      },
    };
  },
}));

vi.mock("./listing-credits", () => ({
  LISTING_CREDIT_COSTS: { spotlight7Days: 5, homepageSpotlight: 20 },
  consumeCredits: async (
    creatorId: string,
    amount: number,
    reason: string
  ) => {
    h.consumedCalls.push({ creatorId, amount, reason });
    return { ok: true };
  },
  addCredits: async (creatorId: string, amount: number, reason: string) => {
    h.refundCalls.push({ creatorId, amount, reason });
    return { ok: true };
  },
  canCreateHandmadeListing: async () => ({ ok: true }),
  countActiveHandmadeProducts: async () => 0,
  getCreditBalance: async () => 0,
  getEventCreditCost: (_c: unknown, _t: unknown) => 1,
}));

vi.mock("./ranking", () => ({
  createVisibilityBoost: async (input: {
    entityType: string;
    entityId: string;
  }) => {
    h.boostCalls.push(input);
    return h.boostResult;
  },
  grantPlanVisibilityBoost: vi.fn(),
}));

import { purchaseSpotlightBoostAction } from "./commercial-enforcement";

const CREATOR = "creator-A";

function resetTables() {
  h.tables = {
    products: [{ id: "prod-1", creator_id: CREATOR }],
    workshops: [{ id: "ws-1", creator_id: CREATOR }],
    events: [{ id: "ev-1", organizer_creator_id: CREATOR }],
  };
  h.selectError = null;
}

describe("purchaseSpotlightBoostAction — P1-3 ownership + refund", () => {
  beforeEach(() => {
    resetTables();
    h.consumedCalls = [];
    h.refundCalls = [];
    h.boostCalls = [];
    h.boostResult = { ok: true, id: "boost-1" };
  });

  it("rejects boosting another creator's product before deducting credits", async () => {
    h.tables.products.push({ id: "prod-other", creator_id: "creator-B" });

    const result = await purchaseSpotlightBoostAction({
      creatorId: CREATOR,
      entityType: "product",
      entityId: "prod-other",
    });

    expect(result.ok).toBe(false);
    expect(h.consumedCalls).toEqual([]);
    expect(h.boostCalls).toEqual([]);
  });

  it("rejects boosting a non-existent entity before deducting credits", async () => {
    const result = await purchaseSpotlightBoostAction({
      creatorId: CREATOR,
      entityType: "workshop",
      entityId: "does-not-exist",
    });

    expect(result.ok).toBe(false);
    expect(h.consumedCalls).toEqual([]);
  });

  it("rejects boosting someone else's event (organizer_creator_id check)", async () => {
    h.tables.events.push({ id: "ev-other", organizer_creator_id: "creator-B" });

    const result = await purchaseSpotlightBoostAction({
      creatorId: CREATOR,
      entityType: "event",
      entityId: "ev-other",
    });

    expect(result.ok).toBe(false);
    expect(h.consumedCalls).toEqual([]);
  });

  it("rejects boosting another creator's profile outright", async () => {
    const result = await purchaseSpotlightBoostAction({
      creatorId: CREATOR,
      entityType: "creator",
      entityId: "creator-B",
    });

    expect(result.ok).toBe(false);
    expect(h.consumedCalls).toEqual([]);
  });

  it("allows boosting your own product end-to-end", async () => {
    const result = await purchaseSpotlightBoostAction({
      creatorId: CREATOR,
      entityType: "product",
      entityId: "prod-1",
    });

    expect(result.ok).toBe(true);
    expect(h.consumedCalls).toHaveLength(1);
    expect(h.boostCalls).toHaveLength(1);
    expect(h.boostCalls[0].entityId).toBe("prod-1");
    expect(h.refundCalls).toEqual([]);
  });

  it("refunds credits when the boost insert fails after deduction", async () => {
    h.boostResult = { ok: false, error: "db write failed" };

    const result = await purchaseSpotlightBoostAction({
      creatorId: CREATOR,
      entityType: "product",
      entityId: "prod-1",
    });

    expect(result.ok).toBe(false);
    expect(h.consumedCalls).toHaveLength(1);
    expect(h.refundCalls).toHaveLength(1);
    // Refund matches the deducted amount.
    expect(h.refundCalls[0].amount).toBe(h.consumedCalls[0].amount);
    expect(h.refundCalls[0].reason).toBe("spotlight_refund");
  });
});
