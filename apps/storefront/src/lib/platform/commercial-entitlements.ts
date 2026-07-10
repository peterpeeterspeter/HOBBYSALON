import "server-only";

import type { CommercialPlan, CommercialSegment, Creator } from "@/types/platform";
import {
  getActivePlanForCreator,
  getActivePlanForEvent,
  getActivePlansForCreator,
  isCommercialGatingEnabled,
} from "./queries/commercial-plans";

export { isCommercialGatingEnabled };

export type SegmentEntitlements = {
  segment: CommercialSegment;
  plan: CommercialPlan | null;
  externalLinksAllowed: boolean;
  featuredAllowed: boolean;
  videoAllowed: boolean;
  analyticsAllowed: boolean;
  listingLimit: number | null;
  productLimit: number | null;
};

export type CommercialEntitlements = {
  gatingEnabled: boolean;
  segments: SegmentEntitlements[];
  bySegment: Partial<Record<CommercialSegment, SegmentEntitlements>>;
};

export type EventEntitlements = {
  gatingEnabled: boolean;
  plan: CommercialPlan | null;
  externalLinksAllowed: boolean;
  featuredAllowed: boolean;
};

const DEFAULT_LISTING_LIMIT = 1;

const CREATOR_TYPE_TO_SEGMENT: Record<string, CommercialSegment> = {
  workshopgever: "workshop",
  maker: "maker",
  supplier: "supplier",
  organizer: "organizer",
};

function planToEntitlements(
  segment: CommercialSegment,
  plan: CommercialPlan | null,
  gatingEnabled: boolean
): SegmentEntitlements {
  if (!gatingEnabled) {
    return {
      segment,
      plan,
      externalLinksAllowed: true,
      featuredAllowed: true,
      videoAllowed: true,
      analyticsAllowed: true,
      listingLimit: null,
      productLimit: null,
    };
  }

  if (!plan) {
    return {
      segment,
      plan: null,
      externalLinksAllowed: false,
      featuredAllowed: false,
      videoAllowed: false,
      analyticsAllowed: false,
      listingLimit: segment === "workshop" ? DEFAULT_LISTING_LIMIT : null,
      productLimit: null,
    };
  }

  return {
    segment,
    plan,
    externalLinksAllowed: plan.external_links_allowed,
    featuredAllowed: plan.featured_allowed,
    videoAllowed: plan.video_allowed,
    analyticsAllowed: plan.analytics_allowed,
    listingLimit: plan.listing_limit,
    productLimit: plan.product_limit,
  };
}

export function resolveCreatorSegments(creator: Pick<Creator, "creator_types">): CommercialSegment[] {
  const segments = new Set<CommercialSegment>();
  for (const type of creator.creator_types ?? []) {
    const segment = CREATOR_TYPE_TO_SEGMENT[type];
    if (segment) segments.add(segment);
  }
  return [...segments];
}

export async function getCreatorCommercialEntitlements(
  creatorId: string,
  creatorTypes?: string[]
): Promise<CommercialEntitlements> {
  const gatingEnabled = isCommercialGatingEnabled();
  const subscriptions = await getActivePlansForCreator(creatorId);

  const segmentsFromTypes = (creatorTypes ?? []).reduce<CommercialSegment[]>((acc, type) => {
    const segment = CREATOR_TYPE_TO_SEGMENT[type];
    if (segment && !acc.includes(segment)) acc.push(segment);
    return acc;
  }, []);

  const segmentsFromSubs = subscriptions.map((s) => s.plan.segment);
  const allSegments = [...new Set([...segmentsFromTypes, ...segmentsFromSubs])];

  const segmentEntitlements = allSegments.map((segment) => {
    const sub = subscriptions.find((s) => s.plan.segment === segment);
    return planToEntitlements(segment, sub?.plan ?? null, gatingEnabled);
  });

  const bySegment = segmentEntitlements.reduce<
    Partial<Record<CommercialSegment, SegmentEntitlements>>
  >((acc, ent) => {
    acc[ent.segment] = ent;
    return acc;
  }, {});

  return { gatingEnabled, segments: segmentEntitlements, bySegment };
}

export async function getEventCommercialEntitlements(
  eventId: string
): Promise<EventEntitlements> {
  const gatingEnabled = isCommercialGatingEnabled();
  const subscription = await getActivePlanForEvent(eventId);
  const plan = subscription?.plan ?? null;

  if (!gatingEnabled) {
    return {
      gatingEnabled: false,
      plan,
      externalLinksAllowed: true,
      featuredAllowed: true,
    };
  }

  return {
    gatingEnabled: true,
    plan,
    externalLinksAllowed: plan?.external_links_allowed ?? false,
    featuredAllowed: plan?.featured_allowed ?? false,
  };
}

export function getSegmentEntitlements(
  entitlements: CommercialEntitlements,
  segment: CommercialSegment
): SegmentEntitlements {
  return (
    entitlements.bySegment[segment] ??
    planToEntitlements(segment, null, entitlements.gatingEnabled)
  );
}

export function canShowExternalLinks(
  entitlements: CommercialEntitlements,
  segment: CommercialSegment
): boolean {
  return getSegmentEntitlements(entitlements, segment).externalLinksAllowed;
}

export function canUseExternalBookingLink(
  entitlements: CommercialEntitlements
): boolean {
  return getSegmentEntitlements(entitlements, "workshop").externalLinksAllowed;
}

export function canUseExternalTicketLink(eventEntitlements: EventEntitlements): boolean {
  return eventEntitlements.externalLinksAllowed;
}

export function canFeatureEntity(
  entitlements: CommercialEntitlements,
  segment: CommercialSegment
): boolean {
  return getSegmentEntitlements(entitlements, segment).featuredAllowed;
}

export function getWorkshopListingLimit(
  entitlements: CommercialEntitlements
): number | null {
  const workshop = getSegmentEntitlements(entitlements, "workshop");
  if (!entitlements.gatingEnabled) return null;
  return workshop.listingLimit;
}

export function getHandmadeListingAllowance(entitlements: CommercialEntitlements): {
  usesCredits: boolean;
  includedFree: number;
} {
  const maker = getSegmentEntitlements(entitlements, "maker");
  if (!entitlements.gatingEnabled) {
    return { usesCredits: false, includedFree: Number.MAX_SAFE_INTEGER };
  }
  if (maker.plan?.code === "maker_premium") {
    return { usesCredits: false, includedFree: maker.productLimit ?? 50 };
  }
  return { usesCredits: true, includedFree: 0 };
}

export async function getWorkshopEntitlementsForCreator(
  creatorId: string
): Promise<SegmentEntitlements> {
  const gatingEnabled = isCommercialGatingEnabled();
  const sub = await getActivePlanForCreator(creatorId, "workshop");
  return planToEntitlements("workshop", sub?.plan ?? null, gatingEnabled);
}

export async function getMakerEntitlementsForCreator(
  creatorId: string
): Promise<SegmentEntitlements> {
  const gatingEnabled = isCommercialGatingEnabled();
  const sub = await getActivePlanForCreator(creatorId, "maker");
  return planToEntitlements("maker", sub?.plan ?? null, gatingEnabled);
}
