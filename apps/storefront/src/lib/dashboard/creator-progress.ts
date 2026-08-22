import type { Creator } from "@/types/platform";
import type { RegistrationOfferRole } from "@/lib/auth/registration-options";
import { getFirstListingPath, getPublishPath } from "@/lib/onboarding/offer-onboarding";

export type CreatorProgressStep = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
};

export type CreatorProgressInput = {
  creator: Creator | null;
  domainCount: number;
  productCount: number;
  workshopCount: number;
  eventCount: number;
  articleCount: number;
  projectCount: number;
  publishedWorkshopCount?: number;
  publishedEventCount?: number;
  publishedProductCount?: number;
  primaryOfferRole?: RegistrationOfferRole | null;
  canPublish?: boolean;
};

export function getCreatorProgressSteps(
  input: CreatorProgressInput
): CreatorProgressStep[] {
  const {
    creator,
    domainCount,
    productCount,
    workshopCount,
    eventCount,
    publishedWorkshopCount = 0,
    publishedEventCount = 0,
    publishedProductCount = 0,
    primaryOfferRole,
    canPublish = false,
  } = input;

  const hasName = Boolean(
    creator?.business_name?.trim() || creator?.display_name?.trim()
  );
  const hasBasics =
    hasName &&
    Boolean(creator?.city?.trim()) &&
    Boolean(creator?.bio?.trim()) &&
    domainCount > 0;

  const role = primaryOfferRole ?? "maker";

  if (role === "workshopgever") {
    const hasDraft = workshopCount > 0;
    const hasPublished = publishedWorkshopCount > 0;
    return [
      {
        id: "basics",
        label: "Basisgegevens",
        done: hasBasics,
        href: "/onboarding",
      },
      {
        id: "first-draft",
        label: "Eerste workshop als concept",
        done: hasDraft,
        href: getFirstListingPath("workshopgever"),
      },
      {
        id: "publish",
        label: canPublish || hasPublished ? "Workshop publiceren" : "Publiceren na goedkeuring",
        done: hasPublished,
        href: getPublishPath("workshopgever"),
      },
    ];
  }

  if (role === "organizer") {
    const hasDraft = eventCount > 0;
    const hasPublished = publishedEventCount > 0;
    return [
      {
        id: "basics",
        label: "Basisgegevens",
        done: hasBasics,
        href: "/onboarding",
      },
      {
        id: "first-draft",
        label: "Eerste evenement als concept",
        done: hasDraft,
        href: getFirstListingPath("organizer"),
      },
      {
        id: "publish",
        label: canPublish || hasPublished ? "Evenement publiceren" : "Publiceren na goedkeuring",
        done: hasPublished,
        href: getPublishPath("organizer"),
      },
    ];
  }

  const hasDraft = productCount > 0;
  const hasPublished = publishedProductCount > 0;
  return [
    {
      id: "basics",
      label: "Basisgegevens",
      done: hasBasics,
      href: "/onboarding",
    },
    {
      id: "first-draft",
      label: "Eerste creatie als concept",
      done: hasDraft,
      href: getFirstListingPath("maker"),
    },
    {
      id: "publish",
      label: "Creatie publiceren",
      done: hasPublished,
      href: getPublishPath("maker"),
    },
  ];
}

export function getCreatorProgressPercent(steps: CreatorProgressStep[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((step) => step.done).length;
  return Math.round((done / steps.length) * 100);
}

export function getNextProgressStep(
  steps: CreatorProgressStep[]
): CreatorProgressStep | null {
  return steps.find((step) => !step.done) ?? null;
}
