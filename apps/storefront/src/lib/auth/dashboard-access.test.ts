import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { buildRoleAwareDashboardNav, resolveDashboardCapabilities } from "./dashboard-access.ts";

const baseContext = {
  roles: ["user"] as const,
  preference: null,
  sellerLinks: [] as Array<{ sellerId: string; sellerType: "creator" | "merchant" }>,
  hasCreatorProfile: false,
};

test("hobbyist only sees overview and account", () => {
  const caps = resolveDashboardCapabilities({
    registrationContext: { ...baseContext, roles: ["user"] },
  });
  const nav = buildRoleAwareDashboardNav(caps).map((item) => item.href);
  assert.deepEqual(nav, ["/dashboard", "/dashboard/account"]);
  assert.equal(caps.canAccessVendorPortal, false);
  assert.equal(caps.canManageWorkshops, false);
  assert.equal(caps.canManageEvents, false);
});

test("workshopgever sees workshops but not events or vendor portal", () => {
  const caps = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "creator", "workshop_host"],
      hasCreatorProfile: true,
    },
    creatorTypes: ["workshopgever"],
    hasCreatorProfile: true,
  });
  const nav = buildRoleAwareDashboardNav(caps).map((item) => item.href);
  assert.ok(nav.includes("/dashboard/workshops"));
  assert.ok(nav.includes("/dashboard/creator"));
  assert.ok(!nav.includes("/dashboard/events"));
  assert.ok(!nav.includes("/dashboard/verkoper"));
  assert.ok(!nav.includes("/dashboard/products"));
});

test("organizer sees events but not workshops or vendor portal", () => {
  const caps = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "creator", "organizer"],
      hasCreatorProfile: true,
    },
    creatorTypes: ["organizer"],
    hasCreatorProfile: true,
  });
  const nav = buildRoleAwareDashboardNav(caps).map((item) => item.href);
  assert.ok(nav.includes("/dashboard/events"));
  assert.ok(!nav.includes("/dashboard/workshops"));
  assert.ok(!nav.includes("/dashboard/verkoper"));
});

test("vendor portal only for merchant role with merchant seller link", () => {
  const withoutLink = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "merchant"],
      sellerLinks: [{ sellerId: "sel_creator", sellerType: "creator" }],
    },
  });
  assert.equal(withoutLink.canAccessVendorPortal, false);

  const withMerchant = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "merchant"],
      sellerLinks: [{ sellerId: "sel_merchant", sellerType: "merchant" }],
    },
  });
  assert.equal(withMerchant.canAccessVendorPortal, true);
  const nav = buildRoleAwareDashboardNav(withMerchant).map((item) => item.href);
  assert.ok(nav.includes("/dashboard/verkoper"));
  assert.ok(!nav.includes("/dashboard/workshops"));
  assert.ok(!nav.includes("/dashboard/events"));
});
