import type {
  UserAccountRole,
  UserRegistrationContext,
} from "@/lib/platform/queries/user-registration";

export type CreatorTypeValue =
  | "maker"
  | "workshopgever"
  | "supplier"
  | "content_creator"
  | "organizer";

export type DashboardCapabilities = {
  roles: UserAccountRole[];
  creatorTypes: CreatorTypeValue[];
  hasCreatorProfile: boolean;
  /** Merchant role + merchant Medusa seller — handoff to verkoper.hobbysalon.be. */
  canAccessVendorPortal: boolean;
  /** Show Verkopersportaal tab (merchant role or seller link, setup may still be pending). */
  canViewVendorPortalNav: boolean;
  canViewSoughtMaterials: boolean;
  /** Public maker page, artikels, portfolio. */
  canViewCreatorPage: boolean;
  canManageProducts: boolean;
  /** Create/edit workshop drafts (profile + host role, type, or pending request). */
  canDraftWorkshops: boolean;
  /** Publish workshops publicly (approved workshop_host only). */
  canPublishWorkshops: boolean;
  /** @deprecated Prefer canDraftWorkshops / canPublishWorkshops */
  canManageWorkshops: boolean;
  canDraftEvents: boolean;
  canPublishEvents: boolean;
  /** @deprecated Prefer canDraftEvents / canPublishEvents */
  canManageEvents: boolean;
  canManageOrders: boolean;
  canViewAnalytics: boolean;
  /** No provider roles — hobbyist discovery account. */
  isHobbyistOnly: boolean;
  /** Offer intent without creator profile yet. */
  hasOfferIntent: boolean;
};

export type DashboardNavItemDef = {
  href: string;
  label: string;
  /** Optional count badge (e.g. new product inquiries). */
  badge?: number;
};

const CREATOR_TYPE_SET = new Set<string>([
  "maker",
  "workshopgever",
  "supplier",
  "content_creator",
  "organizer",
]);

function normalizeCreatorTypes(
  values: string[] | null | undefined
): CreatorTypeValue[] {
  if (!values?.length) return [];
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value): value is CreatorTypeValue => CREATOR_TYPE_SET.has(value))
    )
  );
}

export function resolveDashboardCapabilities(input: {
  registrationContext: UserRegistrationContext;
  creatorTypes?: string[] | null;
  hasCreatorProfile?: boolean;
}): DashboardCapabilities {
  const roles = input.registrationContext.roles;
  const creatorTypes = normalizeCreatorTypes(input.creatorTypes);
  const hasCreatorProfile =
    input.hasCreatorProfile ?? input.registrationContext.hasCreatorProfile;

  const hasMerchantRole = roles.includes("merchant");
  const hasMerchantSellerLink = input.registrationContext.sellerLinks.some(
    (link) => link.sellerType === "merchant"
  );

  const hasWorkshopHostRole = roles.includes("workshop_host");
  const hasOrganizerRole = roles.includes("organizer");
  const hasCreatorRole = roles.includes("creator");

  // Self-declared: what the creator says they do. Drives how their public
  // profile presents them, never what they can manage.
  const isWorkshopgever =
    creatorTypes.includes("workshopgever") || hasWorkshopHostRole;
  const isOrganizer = creatorTypes.includes("organizer") || hasOrganizerRole;
  const isMaker = creatorTypes.includes("maker");
  const isSupplier = creatorTypes.includes("supplier");
  const isContentCreator = creatorTypes.includes("content_creator");

  const hasPendingMerchantRequest = input.registrationContext.pendingRoleRequests.some(
    (request) => request.role === "merchant" && request.status === "pending"
  );

  const canAccessVendorPortal = hasMerchantRole && hasMerchantSellerLink;
  const canViewVendorPortalNav =
    hasMerchantRole || hasMerchantSellerLink || hasPendingMerchantRequest;
  const canViewSoughtMaterials = hasMerchantRole && hasMerchantSellerLink;

  const canViewCreatorPage =
    hasCreatorProfile ||
    hasCreatorRole ||
    isWorkshopgever ||
    isOrganizer ||
    isMaker ||
    isSupplier ||
    isContentCreator;

  const canManageProducts =
    hasCreatorProfile &&
    (isMaker ||
      isSupplier ||
      (creatorTypes.length === 0 && (hasCreatorRole || hasCreatorProfile)));

  const hasPendingWorkshopHostRequest =
    input.registrationContext.pendingRoleRequests.some(
      (request) => request.role === "workshop_host" && request.status === "pending"
    );
  const hasRejectedWorkshopHostRequest =
    input.registrationContext.pendingRoleRequests.some(
      (request) => request.role === "workshop_host" && request.status === "rejected"
    );
  const hasPendingOrganizerRequest =
    input.registrationContext.pendingRoleRequests.some(
      (request) => request.role === "organizer" && request.status === "pending"
    );
  const hasRejectedOrganizerRequest =
    input.registrationContext.pendingRoleRequests.some(
      (request) => request.role === "organizer" && request.status === "rejected"
    );

  const offerRoles = input.registrationContext.preference?.offerRoles ?? [];
  const hasOfferIntent =
    offerRoles.length > 0 ||
    Boolean(input.registrationContext.preference?.primaryOfferRole);

  // Draft: approved role, pending request, or declared type (unless rejected).
  // Publish: approved privileged account role only.
  const canDraftWorkshops =
    hasCreatorProfile &&
    (hasWorkshopHostRole ||
      hasPendingWorkshopHostRequest ||
      (creatorTypes.includes("workshopgever") && !hasRejectedWorkshopHostRequest));
  const canPublishWorkshops = hasCreatorProfile && hasWorkshopHostRole;
  const canManageWorkshops = canDraftWorkshops;

  const canDraftEvents =
    hasCreatorProfile &&
    (hasOrganizerRole ||
      hasPendingOrganizerRequest ||
      (creatorTypes.includes("organizer") && !hasRejectedOrganizerRequest));
  const canPublishEvents = hasCreatorProfile && hasOrganizerRole;
  const canManageEvents = canDraftEvents;

  // Orders only for material merchants with a Medusa seller link.
  // Maker/creator listings do not go through Medusa checkout.
  const canManageOrders = hasMerchantRole && hasMerchantSellerLink;
  // Analytics stays out of the Pro menu for now (page remains gated off).
  const canViewAnalytics = false;

  const isHobbyistOnly =
    !hasMerchantRole &&
    !hasCreatorRole &&
    !hasWorkshopHostRole &&
    !hasOrganizerRole &&
    !hasCreatorProfile &&
    !hasOfferIntent;

  return {
    roles,
    creatorTypes,
    hasCreatorProfile,
    canAccessVendorPortal,
    canViewVendorPortalNav,
    canViewSoughtMaterials,
    canViewCreatorPage,
    canManageProducts,
    canDraftWorkshops,
    canPublishWorkshops,
    canManageWorkshops,
    canDraftEvents,
    canPublishEvents,
    canManageEvents,
    canManageOrders,
    canViewAnalytics,
    isHobbyistOnly,
    hasOfferIntent,
  };
}

export function buildRoleAwareDashboardNav(
  caps: DashboardCapabilities,
  options?: {
    userIsModerator?: boolean;
    newProductInquiryCount?: number;
    newWorkshopBookingCount?: number;
    newEventVendorInquiryCount?: number;
  }
): DashboardNavItemDef[] {
  const items: DashboardNavItemDef[] = [
    { href: "/dashboard", label: "Overzicht" },
  ];

  if (caps.canManageProducts) {
    items.push({
      href: "/dashboard/products",
      label: "Maker shop",
      badge:
        options?.newProductInquiryCount && options.newProductInquiryCount > 0
          ? options.newProductInquiryCount
          : undefined,
    });
  }

  if (caps.canDraftWorkshops) {
    items.push({
      href: "/dashboard/workshops",
      label: "Workshops",
      badge:
        options?.newWorkshopBookingCount && options.newWorkshopBookingCount > 0
          ? options.newWorkshopBookingCount
          : undefined,
    });
  }

  if (caps.canDraftEvents) {
    items.push({
      href: "/dashboard/events",
      label: "Events",
      badge:
        options?.newEventVendorInquiryCount && options.newEventVendorInquiryCount > 0
          ? options.newEventVendorInquiryCount
          : undefined,
    });
  }

  if (caps.canManageOrders) {
    items.push({ href: "/dashboard/orders", label: "Bestellingen" });
  }

  if (caps.canViewVendorPortalNav) {
    items.push({ href: "/dashboard/verkoper", label: "Verkopersportaal" });
  }

  if (options?.userIsModerator) {
    items.push(
      { href: "/dashboard/materials", label: "Materials Ops" },
      { href: "/dashboard/moderatie/community", label: "Moderatie" },
      { href: "/dashboard/moderatie/roles", label: "Rolaanvragen" }
    );
  }

  return items;
}
