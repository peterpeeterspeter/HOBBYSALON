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
  canManageWorkshops: boolean;
  canManageEvents: boolean;
  canManageOrders: boolean;
  canViewAnalytics: boolean;
  /** No provider roles — hobbyist discovery account. */
  isHobbyistOnly: boolean;
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

  // Privileged capabilities follow the *approved* account role, never the
  // self-declared creator_type. Picking "workshopgever" on the account
  // page files a role request (syncPrivilegedRolesFromCreatorTypes) and
  // approval grants workshop_host; deriving access from creator_types
  // instead made that gate cosmetic - a user could grant themselves
  // access, and a rejected request kept its access too.
  const canManageWorkshops = hasCreatorProfile && hasWorkshopHostRole;
  const canManageEvents = hasCreatorProfile && hasOrganizerRole;
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
    !hasCreatorProfile;

  return {
    roles,
    creatorTypes,
    hasCreatorProfile,
    canAccessVendorPortal,
    canViewVendorPortalNav,
    canViewSoughtMaterials,
    canViewCreatorPage,
    canManageProducts,
    canManageWorkshops,
    canManageEvents,
    canManageOrders,
    canViewAnalytics,
    isHobbyistOnly,
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
      label: "Jouw Shop",
      badge:
        options?.newProductInquiryCount && options.newProductInquiryCount > 0
          ? options.newProductInquiryCount
          : undefined,
    });
  }

  if (caps.canManageWorkshops) {
    items.push({
      href: "/dashboard/workshops",
      label: "Workshops",
      badge:
        options?.newWorkshopBookingCount && options.newWorkshopBookingCount > 0
          ? options.newWorkshopBookingCount
          : undefined,
    });
  }

  if (caps.canManageEvents) {
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
