import type { Domain } from "@/types/platform";
export { ARTICLE_TYPE_OPTIONS } from "@/lib/content/article-types";

export type CreatorTab = "profiel" | "artikels" | "portfolio";

export const CREATOR_TABS: Array<{ id: CreatorTab; label: string }> = [
  { id: "profiel", label: "Profiel" },
  { id: "artikels", label: "Artikels" },
  { id: "portfolio", label: "Portfolio" },
];

export function resolveCreatorTab(tab: string | undefined): CreatorTab {
  const value = tab ?? null;
  if (value === "profiel" || value === "artikels" || value === "portfolio") {
    return value;
  }
  return "profiel";
}

export const CREATOR_TYPES: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  {
    value: "maker",
    label: "Maker",
    description: "Je verkoopt handgemaakte creaties.",
  },
  {
    value: "workshopgever",
    label: "Workshopgever",
    description: "Je geeft workshops of lessen.",
  },
  {
    value: "supplier",
    label: "Leverancier",
    description: "Je verkoopt garen, stof of hobbybenodigdheden.",
  },
  {
    value: "content_creator",
    label: "Content maker",
    description: "Je schrijft tutorials en inspiratie-artikels.",
  },
  {
    value: "organizer",
    label: "Organisator",
    description: "Je organiseert events of beurzen.",
  },
];

export const RELATION_TYPE_LABELS: Record<string, string> = {
  related: "Gerelateerd",
  featured: "Uitgelicht",
  recommended: "Aanbevolen",
  tutorial: "Tutorial-link",
};

export type DashboardArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_markdown: string | null;
  article_type: string;
  domain_id: string | null;
  is_published: boolean;
};

export type ArticleEntityLink = {
  id: string;
  source_entity_id: string;
  target_entity_type: "product" | "workshop" | "event";
  target_entity_id: string;
  relation_type: string;
  weight: number;
  sort_order: number | null;
};

export type CreatorProject = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  featured_image_url: string | null;
};

export type ProjectGalleryImage = {
  id: string;
  project_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
};

export type ProjectProductLink = {
  id: string;
  project_id: string;
  product_id: string;
  link_type: string;
  sort_order: number;
};

export type ProjectSoughtMaterial = {
  id: string;
  project_id: string;
  title: string;
  notes: string | null;
  sort_order: number;
};

export type LinkTargetOption = { id: string; label: string };

export type CreatorProfileTabProps = {
  creator: {
    id?: string;
    display_name: string;
    slug: string;
    business_name: string | null;
    city: string | null;
    website_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    bio: string | null;
    email?: string | null;
    creator_types: string[];
    country_code: string | null;
    open_to_markets?: boolean;
  } | null;
  onboarding: Record<string, unknown> | null;
  accountDisplayName: string;
  accountEmail: string;
  registrationCity: string | null;
  registrationCountryCode: string | null;
  domains: Domain[];
  selectedDomainIds: Set<string>;
};

export type CreatorArticlesTabProps = {
  domains: Domain[];
  articles: DashboardArticle[];
  articleSuggestionsByArticle: Map<string, ArticleEntityLink[]>;
  articleConfirmedByArticle: Map<string, ArticleEntityLink[]>;
  productLabels: Map<string, string>;
  workshopLabels: Map<string, string>;
  eventLabels: Map<string, string>;
};

export type CreatorPortfolioTabProps = {
  projects: CreatorProject[];
  projectImagesByProject: Map<string, ProjectGalleryImage[]>;
  projectLinksByProject: Map<string, ProjectProductLink[]>;
  projectSoughtMaterialsByProject: Map<string, ProjectSoughtMaterial[]>;
  materialProductOptions: LinkTargetOption[];
  ownProductLabels: Map<string, string>;
};
