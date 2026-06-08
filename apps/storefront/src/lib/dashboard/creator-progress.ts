import type { Creator } from "@/types/platform";

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
};

export function getCreatorProgressSteps(
  input: CreatorProgressInput
): CreatorProgressStep[] {
  const { creator, domainCount, productCount, workshopCount, eventCount, articleCount, projectCount } =
    input;

  const hasName = Boolean(creator?.display_name?.trim());
  const hasDomains = domainCount > 0;
  const hasSlug = Boolean(creator?.slug?.trim());
  const hasContent =
    productCount > 0 ||
    workshopCount > 0 ||
    eventCount > 0 ||
    articleCount > 0 ||
    projectCount > 0;

  return [
    {
      id: "profile",
      label: "Profiel ingevuld (naam + hobby)",
      done: hasName && hasDomains,
      href: "/dashboard/creator?tab=profiel",
    },
    {
      id: "public-page",
      label: "Publieke pagina klaar",
      done: hasSlug,
      href: creator?.slug ? `/creator/${creator.slug}` : "/dashboard/creator?tab=profiel",
    },
    {
      id: "content",
      label: "Eerste content toegevoegd",
      done: hasContent,
      href: "/dashboard/products",
    },
  ];
}
