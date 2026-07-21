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
  /** Merchant role + merchant Medusa seller — only then show verkopersportaal. */
  canAccessVendorPortal: boolean;
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
  const hasCreatorSellerLink = input.registrationContext.sellerLinks.some(
    (link) => link.sellerType === "creator"
  );

  const hasWorkshopHostRole = roles.includes("workshop_host");
  const hasOrganizerRole = roles.includes("organizer");
  const hasCreatorRole = roles.includes("creator");

  const isWorkshopgever =
    creatorTypes.includes("workshopgever") || hasWorkshopHostRole;
  const isOrganizer = creatorTypes.includes("organizer") || hasOrganizerRole;
  const isMaker = creatorTypes.includes("maker");
  const isSupplier = creatorTypes.includes("supplier");
  const isContentCreator = creatorTypes.includes("content_creator");

  const canAccessVendorPortal = hasMerchantRole && hasMerchantSellerLink;
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

  const canManageWorkshops = hasCreatorProfile && isWorkshopgever;
  const canManageEvents = hasCreatorProfile && isOrganizer;
  const canManageOrders =
    canManageProducts || (hasCreatorProfile && hasCreatorSellerLink);
  const canViewAnalytics =
    canManageProducts ||
    canManageWorkshops ||
    canManageEvents ||
    (hasCreatorProfile && isContentCreator);

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
  options?: { userIsModerator?: boolean }
): DashboardNavItemDef[] {
  const items: DashboardNavItemDef[] = [
    { href: "/dashboard", label: "Overzicht" },
  ];

  if (caps.canViewCreatorPage) {
    items.push({ href: "/dashboard/creator", label: "Mijn pagina" });
  }

  if (caps.canManageProducts) {
    items.push({ href: "/dashboard/products", label: "Producten" });
  }

  if (caps.canManageWorkshops) {
    items.push({ href: "/dashboard/workshops", label: "Workshops" });
  }

  if (caps.canManageEvents) {
    items.push({ href: "/dashboard/events", label: "Events" });
  }

  if (caps.canManageOrders) {
    items.push({ href: "/dashboard/orders", label: "Bestellingen" });
  }

  if (caps.canAccessVendorPortal) {
    items.push({ href: "/dashboard/verkoper", label: "Verkopersportaal" });
  }

  items.push({ href: "/dashboard/account", label: "Account" });

  if (caps.canViewAnalytics) {
    items.push({ href: "/dashboard/analytics", label: "Analytics" });
  }

  if (options?.userIsModerator) {
    items.push(
      { href: "/dashboard/materials", label: "Materials Ops" },
      { href: "/dashboard/moderatie/community", label: "Moderatie" }
    );
  }

  return items;
}
