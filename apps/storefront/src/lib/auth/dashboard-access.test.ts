import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import {
  buildRoleAwareDashboardNav,
  resolveActiveNavHref,
  resolveDashboardCapabilities,
  resolveOfferSections,
} from "./dashboard-access.ts";

const baseContext = {
  roles: ["user"] as const,
  preference: null,
  sellerLinks: [] as Array<{ sellerId: string; sellerType: "creator" | "merchant" }>,
  hasCreatorProfile: false,
  pendingRoleRequests: [],
};

test("hobbyist only sees overview", () => {
  const caps = resolveDashboardCapabilities({
    registrationContext: { ...baseContext, roles: ["user"] },
  });
  const nav = buildRoleAwareDashboardNav(caps).map((item) => item.href);
  assert.deepEqual(nav, ["/dashboard", "/dashboard/instellingen"]);
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
  assert.ok(nav.includes("/dashboard/aanbod"));
  assert.ok(nav.includes("/dashboard/pagina"));
  assert.ok(!nav.includes("/dashboard/winkel"));
  const sections = resolveOfferSections(caps).map((section) => section.key);
  assert.deepEqual(sections, ["workshops"]);
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
  assert.ok(nav.includes("/dashboard/aanbod"));
  assert.ok(!nav.includes("/dashboard/winkel"));
  assert.deepEqual(
    resolveOfferSections(caps).map((section) => section.key),
    ["events"]
  );
});

test("workshopgever without approved role can draft but not publish", () => {
  const caps = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "creator"],
      hasCreatorProfile: true,
      pendingRoleRequests: [{ id: "req-1", role: "workshop_host", status: "pending", createdAt: "2026-01-01T00:00:00.000Z" }],
      preference: {
        city: null,
        postalCode: null,
        countryCode: "BE",
        interestTypes: [],
        preferredDomainIds: [],
        offerRoles: ["workshopgever"],
        primaryOfferRole: "workshopgever",
        marketingOptIn: false,
        marketingOptedInAt: null,
        marketingOptedOutAt: null,
        marketingConsentSource: null,
        onboardingCompleted: false,
      },
    },
    creatorTypes: ["workshopgever"],
    hasCreatorProfile: true,
  });
  assert.equal(caps.canDraftWorkshops, true);
  assert.equal(caps.canPublishWorkshops, false);
  assert.equal(caps.canManageWorkshops, true);
});

test("vendor portal nav for pending merchant request", () => {
  const pending = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user"],
      pendingRoleRequests: [
        {
          id: "req-merchant",
          role: "merchant",
          status: "pending",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  });
  assert.equal(pending.canAccessVendorPortal, false);
  assert.equal(pending.canViewVendorPortalNav, true);
  const nav = buildRoleAwareDashboardNav(pending).map((item) => item.href);
  assert.ok(nav.includes("/dashboard/winkel"));
});

test("vendor portal nav for merchant role with or without seller link", () => {
  const withoutLink = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "merchant"],
      sellerLinks: [{ sellerId: "sel_creator", sellerType: "creator" }],
    },
  });
  assert.equal(withoutLink.canAccessVendorPortal, false);
  assert.equal(withoutLink.canViewVendorPortalNav, true);
  const navWithoutLink = buildRoleAwareDashboardNav(withoutLink).map((item) => item.href);
  assert.ok(navWithoutLink.includes("/dashboard/winkel"));

  const withMerchant = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "merchant"],
      sellerLinks: [{ sellerId: "sel_merchant", sellerType: "merchant" }],
    },
  });
  assert.equal(withMerchant.canAccessVendorPortal, true);
  assert.equal(withMerchant.canViewVendorPortalNav, true);
  const nav = buildRoleAwareDashboardNav(withMerchant).map((item) => item.href);
  assert.ok(nav.includes("/dashboard/winkel"));
  assert.ok(!nav.includes("/dashboard/aanbod"));
  assert.deepEqual(resolveOfferSections(withMerchant), []);
});

test("organizer without approved role can draft but not publish", () => {
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
  assert.equal(caps.canDraftEvents, true);
  assert.equal(caps.canPublishEvents, false);
  assert.equal(caps.canManageEvents, true);
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
  assert.equal(caps.canDraftEvents, false);
  assert.equal(caps.canPublishEvents, false);
  assert.equal(caps.canManageEvents, false);
  // Being a maker is not gated on approval, so that stays available.
  assert.equal(caps.canManageProducts, true);
});

test("orders are only for merchants with a Medusa seller link", () => {
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

  // Creator seller links no longer unlock Bestellingen — only merchants.
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
  assert.equal(makerWithCreatorLink.canManageOrders, false);
  assert.ok(
    !buildRoleAwareDashboardNav(makerWithCreatorLink)
      .map((item) => item.href)
      .includes("/dashboard/orders")
  );
  assert.ok(
    !buildRoleAwareDashboardNav(makerWithCreatorLink)
      .map((item) => item.href)
      .includes("/dashboard/analytics")
  );

  const merchant = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "merchant"],
      sellerLinks: [{ sellerId: "sel_merchant", sellerType: "merchant" }],
    },
  });
  assert.equal(merchant.canManageOrders, true);
  assert.ok(
    buildRoleAwareDashboardNav(merchant)
      .map((item) => item.href)
      .includes("/dashboard/winkel")
  );
});

test("nav has at most six top-level items, even for every role at once", () => {
  const everything = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "creator", "merchant", "organizer", "workshop_host"],
      hasCreatorProfile: true,
      sellerLinks: [{ sellerId: "sel_merchant", sellerType: "merchant" }],
    },
    creatorTypes: ["maker", "workshopgever", "organizer"],
    hasCreatorProfile: true,
  });
  const nav = buildRoleAwareDashboardNav(everything, { userIsModerator: true });
  assert.ok(nav.length <= 6);
  assert.deepEqual(
    resolveOfferSections(everything).map((section) => section.key),
    ["creaties", "workshops", "events"]
  );
});

test("new requests from all sources add up on Vandaag", () => {
  const caps = resolveDashboardCapabilities({
    registrationContext: { ...baseContext, roles: ["user", "creator"], hasCreatorProfile: true },
    creatorTypes: ["maker"],
    hasCreatorProfile: true,
  });
  const nav = buildRoleAwareDashboardNav(caps, {
    newProductInquiryCount: 2,
    newWorkshopBookingCount: 1,
    newEventVendorInquiryCount: 3,
  });
  assert.equal(nav[0].href, "/dashboard");
  assert.equal(nav[0].badge, 6);
});

test("old dashboard routes highlight their new parent", () => {
  assert.equal(resolveActiveNavHref("/dashboard/workshops"), "/dashboard/aanbod");
  assert.equal(resolveActiveNavHref("/dashboard/events/new"), "/dashboard/aanbod");
  assert.equal(resolveActiveNavHref("/dashboard/orders"), "/dashboard/winkel");
  assert.equal(resolveActiveNavHref("/dashboard/verkoper"), "/dashboard/winkel");
  assert.equal(resolveActiveNavHref("/beheer/rollen"), "/beheer");
  assert.equal(resolveActiveNavHref("/dashboard"), "/dashboard");
});

test("offer intent without a page yet can open Mijn pagina; a pure merchant cannot", () => {
  const intentOnly = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user"],
      preference: {
        city: null,
        postalCode: null,
        countryCode: "BE",
        interestTypes: [],
        preferredDomainIds: [],
        offerRoles: ["maker"],
        primaryOfferRole: "maker",
        marketingOptIn: false,
        marketingOptedInAt: null,
        marketingOptedOutAt: null,
        marketingConsentSource: null,
        onboardingCompleted: false,
      },
    },
  });
  assert.equal(intentOnly.canViewCreatorPage, false);
  assert.equal(intentOnly.canEditCreatorPage, true);
  assert.ok(
    buildRoleAwareDashboardNav(intentOnly)
      .map((item) => item.href)
      .includes("/dashboard/pagina")
  );

  const merchantOnly = resolveDashboardCapabilities({
    registrationContext: {
      ...baseContext,
      roles: ["user", "merchant"],
      sellerLinks: [{ sellerId: "sel_merchant", sellerType: "merchant" }],
      preference: {
        city: null,
        postalCode: null,
        countryCode: "BE",
        interestTypes: [],
        preferredDomainIds: [],
        offerRoles: ["merchant"],
        primaryOfferRole: "merchant",
        marketingOptIn: false,
        marketingOptedInAt: null,
        marketingOptedOutAt: null,
        marketingConsentSource: null,
        onboardingCompleted: true,
      },
    },
  });
  assert.equal(merchantOnly.canEditCreatorPage, false);
});
