import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for the P1-4 image-generation rate limiter (commit 70e3e595).
 *
 * The limiter must:
 *  - allow requests below the cap (20/hour),
 *  - block at the cap with a retry-after hint,
 *  - FAIL CLOSED on transient DB errors (no unmetered spend during outages).
 */

const h = vi.hoisted(() => {
  const state = {
    countResult: { count: 0, error: null as { message: string } | null },
    insertError: null as { message: string } | null,
    inserted: [] as Array<Record<string, unknown>>,
  };
  return state;
});

vi.mock("@/lib/platform/client", () => ({
  createPlatformClient() {
    return {
      from(table: string) {
        if (table !== "user_activity_log") {
          throw new Error(`unexpected table ${table}`);
        }
        return {
          select(_cols?: string, opts?: { count?: string; head?: boolean }) {
            const isCount = opts?.head && opts?.count === "exact";
            const chain2 = {
              eq() {
                return chain2;
              },
              gte() {
                return chain2;
              },
              async then(resolve: (v: { count: number; error: unknown }) => void) {
                resolve(
                  isCount
                    ? { count: h.countResult.count, error: h.countResult.error }
                    : { count: 0, error: null }
                );
              },
            };
            return chain2;
          },
          async single() {
            return { data: null, error: h.insertError };
          },
          insert(payload: Record<string, unknown>) {
            return {
              async then(resolve: (v: { error: unknown }) => void) {
                if (!h.insertError) h.inserted.push(payload);
                resolve({ error: h.insertError });
              },
            };
          },
        };
      },
    };
  },
}));

import {
  checkImageGenerationRateLimit,
  recordImageGeneration,
} from "./image-generation-limits";

describe("checkImageGenerationRateLimit — P1-4", () => {
  beforeEach(() => {
    h.countResult = { count: 0, error: null };
    h.insertError = null;
    h.inserted = [];
  });

  it("allows under the cap", async () => {
    h.countResult.count = 19;
    const result = await checkImageGenerationRateLimit("user-1");
    expect(result.allowed).toBe(true);
  });

  it("blocks at the cap with a retry-after hint", async () => {
    h.countResult.count = 20;
    const result = await checkImageGenerationRateLimit("user-1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails closed on a transient DB error", async () => {
    h.countResult.error = { message: "connection reset" };
    const result = await checkImageGenerationRateLimit("user-1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("recordImageGeneration — P1-4", () => {
  it("records the event with the fixed event name", async () => {
    await recordImageGeneration("user-1");
    expect(h.inserted).toHaveLength(1);
    expect(h.inserted[0].event_name).toBe("image_generation");
    expect(h.inserted[0].user_id).toBe("user-1");
  });
});
