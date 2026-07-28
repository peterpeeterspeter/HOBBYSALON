import type { Metadata } from "next";
import Link from "next/link";
import { WorkshopCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryCircles } from "@/components/materials/CategoryCircles";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { MaterialsPagination } from "@/components/materials/MaterialsPagination";
import { WorkshopsSidebar } from "@/components/workshops/WorkshopsSidebar";
import { WorkshopsToolbar } from "@/components/workshops/WorkshopsToolbar";
import { WorkshopRow } from "@/components/workshops/WorkshopRow";
import { DiscoveryHero } from "@/components/discovery/DiscoveryHero";
import { getLocationPreference } from "@/lib/location/preference";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { listWorkshopCategories } from "@/lib/platform/queries/workshop-categories";
import { listAllWorkshops } from "@/lib/platform/queries/workshops";
import { listSupplyMarketplaceProducts } from "@/lib/platform/queries/products";
import { createPlatformClient } from "@/lib/platform/client";
import {
  isWorkshopAgeGroup,
  isWorkshopAudienceType,
  isWorkshopLanguage,
  isWorkshopOfferType,
  WORKSHOP_AGE_GROUP_LABELS,
  WORKSHOP_AUDIENCE_LABELS,
  WORKSHOP_LANGUAGE_LABELS,
  WORKSHOP_OFFER_TYPE_LABELS,
  type WorkshopAgeGroup,
  type WorkshopAudienceType,
  type WorkshopLanguage,
} from "@/lib/platform/workshop-taxonomy";
import type { Workshop } from "@/types/platform";

export const metadata: Metadata = {
  title: "Workshops | Hobbysalon",
  description: "Ontdek en boek workshops voor je hobby",
};

type SearchParams = Promise<{
  q?: string;
  domain?: string;
  category?: string;
  difficulty?: string;
  format?: string;
  offer?: string;
  audience?: string | string[];
  age?: string | string[];
  language?: string | string[];
  price_min?: string;
  price_max?: string;
  from?: string;
  to?: string;
  city?: string;
  country?: string;
  sort?: string;
  page?: string;
  view?: string;
}>;

type ParamBag = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 12;

function asStringList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const parts = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      parts
        .flatMap((part) => part.split(","))
        .map((part) => part.trim())
        .filter(Boolean)
    ),
  ];
}

function eurosToCents(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

async function getUniqueWorkshopValues(
  column: "city" | "country_code"
): Promise<string[]> {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("workshops")
    .select(column)
    .eq("is_active", true)
    .not(column, "is", null);

  const values = [
    ...new Set(
      (data ?? [])
        .map((row) => (row as Record<typeof column, string | null>)[column])
        .filter((value): value is string => !!value)
    ),
  ];
  return values.sort();
}

function sortWorkshops(workshops: Workshop[], sort: string): Workshop[] {
  if (sort === "newest") {
    return [...workshops].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  if (sort === "price_asc") {
    return [...workshops].sort((a, b) => a.price_cents - b.price_cents);
  }
  return workshops;
}

function buildWorkshopsHref(
  current: ParamBag,
  overrides: ParamBag = {}
) {
  const merged = { ...current, ...overrides };
  const query = new URLSearchParams();
  Object.entries(merged).forEach(([key, value]) => {
    if (value == null) return;
    const values = Array.isArray(value) ? value : [value];
    values.forEach((entry) => {
      if (entry && entry.trim() && entry !== "all") {
        query.append(key, entry);
      }
    });
  });
  const serialized = query.toString();
  return serialized ? `/workshops?${serialized}` : "/workshops";
}

export default async function WorkshopsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const pageRaw = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const view = params.view === "list" ? "list" : "grid";
  const sort =
    params.sort === "newest" || params.sort === "price_asc"
      ? params.sort
      : "relevance";
  const locationPreference = await getLocationPreference();

  const audience = asStringList(params.audience).filter(isWorkshopAudienceType);
  const age = asStringList(params.age).filter(isWorkshopAgeGroup);
  const language = asStringList(params.language).filter(isWorkshopLanguage);
  const offer =
    params.offer && isWorkshopOfferType(params.offer) ? params.offer : undefined;
  const priceMinCents = eurosToCents(params.price_min);
  const priceMaxCents = eurosToCents(params.price_max);

  const hasAdvancedFilters = Boolean(
    offer ||
      audience.length ||
      age.length ||
      language.length ||
      params.price_min ||
      params.price_max ||
      params.format
  );

  const [domains, categories, allWorkshops, cities, countries] =
    await Promise.all([
      listActiveDomains(),
      listWorkshopCategories({ activeOnly: true }),
      listAllWorkshops({
        q: params.q,
        domain_id: params.domain,
        category_id: params.category,
        difficulty_level: params.difficulty,
        format_type: params.format,
        offer_type: offer,
        audience,
        age,
        language,
        price_min_cents: priceMinCents,
        price_max_cents: priceMaxCents,
        from_date: params.from,
        to_date: params.to,
        city: params.city,
        country_code: params.country,
        preferred_city: locationPreference.city ?? undefined,
        preferred_country_code: locationPreference.countryCode ?? undefined,
      }),
      getUniqueWorkshopValues("city"),
      getUniqueWorkshopValues("country_code"),
    ]);

  const sortedWorkshops = sortWorkshops(allWorkshops, sort);
  const totalCount = sortedWorkshops.length;
  const offset = (page - 1) * PAGE_SIZE;
  const pagedWorkshops = sortedWorkshops.slice(offset, offset + PAGE_SIZE);
  const hasNextPage = offset + PAGE_SIZE < totalCount;

  const graphMaterials = params.domain
    ? await listSupplyMarketplaceProducts({
        domain_id: params.domain,
        limit: 4,
      })
    : [];

  const current: ParamBag = {
    q: params.q,
    domain: params.domain,
    category: params.category,
    difficulty: params.difficulty,
    format: params.format,
    offer,
    audience,
    age,
    language,
    price_min: params.price_min,
    price_max: params.price_max,
    from: params.from,
    to: params.to,
    city: params.city,
    country: params.country,
    sort: params.sort,
    view: params.view,
  };

  const hrefForDomain = (domainId?: string) =>
    buildWorkshopsHref(current, {
      domain: domainId,
      category: undefined,
      page: undefined,
    });
  const hrefForPage = (target: number) =>
    buildWorkshopsHref(current, {
      page: target > 1 ? String(target) : undefined,
    });

  const FORMAT_LABELS: Record<string, string> = {
    physical: "Fysiek",
    online: "Online",
    hybrid: "Hybride",
  };
  const DIFFICULTY_LABELS: Record<string, string> = {
    beginner: "Beginner",
    intermediate: "Gevorderd",
    advanced: "Expert",
  };

  const chips: FilterChip[] = [];
  if (params.q) {
    chips.push({
      label: `"${params.q}"`,
      removeHref: buildWorkshopsHref(current, { q: undefined, page: undefined }),
    });
  }
  if (params.domain) {
    chips.push({
      label: domains.find((d) => d.id === params.domain)?.name ?? "Domein",
      removeHref: buildWorkshopsHref(current, {
        domain: undefined,
        category: undefined,
        page: undefined,
      }),
    });
  }
  if (params.category) {
    chips.push({
      label:
        categories.find((c) => c.id === params.category)?.name ?? "Subcategorie",
      removeHref: buildWorkshopsHref(current, {
        category: undefined,
        page: undefined,
      }),
    });
  }
  if (params.from || params.to) {
    const label =
      params.from && params.to
        ? `${params.from} – ${params.to}`
        : params.from
          ? `Vanaf ${params.from}`
          : `Tot ${params.to}`;
    chips.push({
      label,
      removeHref: buildWorkshopsHref(current, {
        from: undefined,
        to: undefined,
        page: undefined,
      }),
    });
  }
  if (params.city) {
    chips.push({
      label: params.city,
      removeHref: buildWorkshopsHref(current, {
        city: undefined,
        page: undefined,
      }),
    });
  }
  if (params.country) {
    chips.push({
      label: params.country,
      removeHref: buildWorkshopsHref(current, {
        country: undefined,
        page: undefined,
      }),
    });
  }
  if (params.difficulty) {
    chips.push({
      label: DIFFICULTY_LABELS[params.difficulty] ?? params.difficulty,
      removeHref: buildWorkshopsHref(current, {
        difficulty: undefined,
        page: undefined,
      }),
    });
  }
  if (offer) {
    chips.push({
      label: WORKSHOP_OFFER_TYPE_LABELS[offer],
      removeHref: buildWorkshopsHref(current, {
        offer: undefined,
        page: undefined,
      }),
    });
  }
  for (const value of audience) {
    chips.push({
      label: WORKSHOP_AUDIENCE_LABELS[value as WorkshopAudienceType],
      removeHref: buildWorkshopsHref(current, {
        audience: audience.filter((entry) => entry !== value),
        page: undefined,
      }),
    });
  }
  for (const value of age) {
    chips.push({
      label: WORKSHOP_AGE_GROUP_LABELS[value as WorkshopAgeGroup],
      removeHref: buildWorkshopsHref(current, {
        age: age.filter((entry) => entry !== value),
        page: undefined,
      }),
    });
  }
  for (const value of language) {
    chips.push({
      label: WORKSHOP_LANGUAGE_LABELS[value as WorkshopLanguage],
      removeHref: buildWorkshopsHref(current, {
        language: language.filter((entry) => entry !== value),
        page: undefined,
      }),
    });
  }
  if (params.price_min || params.price_max) {
    const label =
      params.price_min && params.price_max
        ? `€${params.price_min}–€${params.price_max}`
        : params.price_min
          ? `Vanaf €${params.price_min}`
          : `Tot €${params.price_max}`;
    chips.push({
      label,
      removeHref: buildWorkshopsHref(current, {
        price_min: undefined,
        price_max: undefined,
        page: undefined,
      }),
    });
  }
  if (params.format) {
    chips.push({
      label: FORMAT_LABELS[params.format] ?? params.format,
      removeHref: buildWorkshopsHref(current, {
        format: undefined,
        page: undefined,
      }),
    });
  }

  return (
    <Container className="py-8">
      <DiscoveryHero
        title="Kies een workshop en leer iets nieuws"
        description="Vind een rustige eerste les of verdiep je techniek bij ervaren workshopgevers, online of bij jou in de buurt."
        searchAction="/workshops"
        searchPlaceholder="Zoek bijvoorbeeld haken, keramiek of Gent"
        locationLabel={
          locationPreference.hasPreference ? locationPreference.label : null
        }
        resetHref="/workshops"
        primaryHref="/agenda"
        primaryLabel="Bekijk creatieve events"
      />

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        <WorkshopsSidebar
          domains={domains}
          categories={categories}
          cities={cities}
          countries={countries}
          hasAdvancedFilters={hasAdvancedFilters}
          params={{
            q: params.q,
            domain: params.domain,
            category: params.category,
            format: params.format,
            difficulty: params.difficulty,
            city: params.city,
            country: params.country,
            from: params.from,
            to: params.to,
            offer,
            audience,
            age,
            language,
            price_min: params.price_min,
            price_max: params.price_max,
            sort: params.sort,
            view: params.view,
          }}
        />

        <div className="min-w-0 flex-1">
          <CategoryCircles
            domains={domains}
            activeDomain={params.domain}
            hrefForDomain={hrefForDomain}
          />

          <ActiveFilterChips chips={chips} clearHref="/workshops" />

          {graphMaterials.length > 0 && (
            <section className="mb-6 rounded-[10px] border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[var(--accent)]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                  Materialen
                </span>
                <span className="text-[15px] font-semibold text-[var(--foreground)]">
                  Schaf hier de benodigdheden aan:
                </span>
                <div className="flex flex-wrap gap-2">
                  {graphMaterials.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.slug}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      {product.featured_image_url && (
                        <img
                          src={product.featured_image_url}
                          alt=""
                          className="h-7 w-7 rounded object-cover"
                          loading="lazy"
                        />
                      )}
                      <span className="max-w-[200px] truncate">
                        {product.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          <WorkshopsToolbar
            resultCount={pagedWorkshops.length}
            totalCount={totalCount}
            view={view}
          />

          {pagedWorkshops.length === 0 ? (
            <EmptyState
              image="emptySearch"
              title="Geen workshops gevonden"
              description="Pas je filters aan of probeer een bredere zoekterm."
              action={{ label: "Alle workshops", href: "/workshops" }}
            />
          ) : view === "list" ? (
            <div className="flex flex-col gap-4">
              {pagedWorkshops.map((workshop) => (
                <WorkshopRow key={workshop.id} workshop={workshop} />
              ))}
            </div>
          ) : (
            <GridLayout cols={3} gap="lg">
              {pagedWorkshops.map((workshop) => (
                <WorkshopCard key={workshop.id} workshop={workshop} />
              ))}
            </GridLayout>
          )}

          <MaterialsPagination
            page={page}
            hasNextPage={hasNextPage}
            hrefForPage={hrefForPage}
          />
        </div>
      </div>
    </Container>
  );
}
