import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression: persistUserRegistrationProfile used to write every preference
 * column on each call. Callers that only pass postcode/interests (merchant
 * upgrade, "Voorkeuren" form) silently reset newsletter consent and the
 * user's offer intent. Only fields the caller provides may be written.
 */

const h = vi.hoisted(() => ({
  upserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
}));

vi.mock("../client", () => ({
  createPlatformClient() {
    return {
      from(table: string) {
        return {
          async upsert(payload: Record<string, unknown>) {
            h.upserts.push({ table, payload });
            return { error: null };
          },
        };
      },
    };
  },
}));

import { persistUserRegistrationProfile } from "./user-registration";

function preferencePayload(): Record<string, unknown> {
  const row = h.upserts.find((u) => u.table === "user_preferences");
  if (!row) throw new Error("no user_preferences upsert");
  return row.payload;
}

describe("persistUserRegistrationProfile partial writes", () => {
  beforeEach(() => {
    h.upserts.length = 0;
  });

  it("leaves consent and offer intent alone when the caller omits them", async () => {
    await persistUserRegistrationProfile({
      userId: "u1",
      postalCode: "2800",
      countryCode: "BE",
      interestTypes: ["supply"],
    });
    const pref = preferencePayload();
    expect(pref).not.toHaveProperty("marketing_opt_in");
    expect(pref).not.toHaveProperty("offer_roles");
    expect(pref).not.toHaveProperty("primary_offer_role");
    expect(pref).not.toHaveProperty("onboarding_completed");
    expect(pref).toMatchObject({
      postal_code: "2800",
      country_code: "BE",
      interest_types: ["supply"],
    });
  });

  it("only writes interests when that is all the caller passes", async () => {
    await persistUserRegistrationProfile({
      userId: "u1",
      interestTypes: ["workshop"],
    });
    expect(preferencePayload()).toEqual({
      user_id: "u1",
      interest_types: ["workshop"],
    });
  });

  it("still writes every field registerAction passes", async () => {
    await persistUserRegistrationProfile({
      userId: "u1",
      postalCode: "2800",
      countryCode: "BE",
      interestTypes: [],
      offerRoles: ["maker"],
      marketingOptIn: true,
      marketingConsentSource: "register",
      onboardingCompleted: false,
    });
    expect(preferencePayload()).toMatchObject({
      offer_roles: ["maker"],
      primary_offer_role: "maker",
      marketing_opt_in: true,
      marketing_consent_source: "register",
      onboarding_completed: false,
    });
  });

  it("keeps the base user role upsert", async () => {
    await persistUserRegistrationProfile({ userId: "u1" });
    expect(h.upserts.find((u) => u.table === "user_account_roles")?.payload).toEqual({
      user_id: "u1",
      role: "user",
    });
  });
});
