import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { buildRoleAwareDashboardNav, resolveDashboardCapabilities } from "./dashboard-access.ts";

const baseContext = {
  roles: ["user"] as const,
  preference: null,
  sellerLinks: [] as Array<{ sellerId: string; sellerType: "creator" | "merchant" }>,
  hasCreatorProfile: false,
  pendingRoleRequests: [],
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
  assert.ok(!nav.includes("/dashboard/creator"));
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

test("workshopgever without approved role does not see workshops", () => {
  const caps = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "creator"],
      hasCreatorProfile: true,
      pendingRoleRequests: [{ id: "req-1", role: "workshop_host", status: "pending", createdAt: "2026-01-01T00:00:00.000Z" }],
    },
    creatorTypes: ["workshopgever"],
    hasCreatorProfile: true,
  });
  assert.equal(caps.canManageWorkshops, false);
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

test("organizer without approved role does not see events", () => {
  const caps = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "creator"],
      hasCreatorProfile: true,
      pendingRoleRequests: [
        {
          id: "req-2",
          role: "organizer",
          status: "pending",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    creatorTypes: ["organizer"],
    hasCreatorProfile: true,
  });
  assert.equal(caps.canManageEvents, false);
});

test("a rejected role request does not grant access", () => {
  // Regression: a moderator rejected the request, but access was derived
  // from the self-assigned creator_type, so the rejection had no effect.
  const caps = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "creator"],
      hasCreatorProfile: true,
      pendingRoleRequests: [
        {
          id: "req-3",
          role: "organizer",
          status: "rejected",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    creatorTypes: ["maker", "organizer"],
    hasCreatorProfile: true,
  });
  assert.equal(caps.canManageEvents, false);
  // Being a maker is not gated on approval, so that stays available.
  assert.equal(caps.canManageProducts, true);
});

test("orders are only for accounts with a real Medusa seller link", () => {
  // Platform-only maker listings never produce a Medusa order, so a maker
  // without a seller link was being shown a permanently empty page.
  const makerWithoutLink = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "creator"],
      hasCreatorProfile: true,
    },
    creatorTypes: ["maker"],
    hasCreatorProfile: true,
  });
  assert.equal(makerWithoutLink.canManageProducts, true);
  assert.equal(makerWithoutLink.canManageOrders, false);
  assert.ok(
    !buildRoleAwareDashboardNav(makerWithoutLink)
      .map((item) => item.href)
      .includes("/dashboard/orders")
  );

  const makerWithCreatorLink = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "creator"],
      hasCreatorProfile: true,
      sellerLinks: [{ sellerId: "sel_creator", sellerType: "creator" }],
    },
    creatorTypes: ["maker"],
    hasCreatorProfile: true,
  });
  assert.equal(makerWithCreatorLink.canManageOrders, true);

  const merchant = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "merchant"],
      sellerLinks: [{ sellerId: "sel_merchant", sellerType: "merchant" }],
    },
  });
  assert.equal(merchant.canManageOrders, true);
});
