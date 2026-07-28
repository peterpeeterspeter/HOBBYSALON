import type { Metadata } from "next";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { MaterialsPagination } from "@/components/materials/MaterialsPagination";
import { Container } from "@/components/ui/container";
import { WorkshopsHero } from "@/components/workshops/WorkshopsHero";
import { WorkshopsQuickFilters } from "@/components/workshops/WorkshopsQuickFilters";
import { WorkshopsHobbyChips } from "@/components/workshops/WorkshopsHobbyChips";
import {
  WorkshopsFilterBar,
  WorkshopsSortControl,
} from "@/components/workshops/WorkshopsFilterBar";
import { WorkshopsResultsHeader } from "@/components/workshops/WorkshopsResultsHeader";
import { WorkshopsGroupedList } from "@/components/workshops/WorkshopsGroupedList";
import { WorkshopsEmptyActions } from "@/components/workshops/WorkshopsEmptyActions";
import {
  formatAgendaPlaceLabel,
  groupWorkshopsByDiscoveryBucket,
  resolveAgendaCustomRange,
  resolveAgendaDatePreset,
  resolveHobbyChipDomainIds,
  sanitizeAgendaSearchQuery,
} from "@/lib/workshops/workshop-discovery-helpers";
import { getLocationPreference } from "@/lib/location/preference";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { listWorkshopCategories } from "@/lib/platform/queries/workshop-categories";
import { listDiscoveryWorkshops } from "@/lib/platform/queries/workshops";
import { createPlatformClient } from "@/lib/platform/client";
import {
  WORKSHOP_EXTENDED_TAXONOMY_FILTERS_ENABLED,
  isWorkshopAgeGroup,
  isWorkshopAudienceType,
  isWorkshopLanguage,
  isWorkshopOfferType,
  parseWorkshopCodeList,
} from "@/lib/platform/workshop-taxonomy";

export const metadata: Metadata = {
  title: "Workshops | Hobbysalon",
  description: "Vind een workshop die bij je past — dichtbij of online",
};

type SearchParams = Promise<{
  q?: string;
  place?: string;
  when?: string;
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
}>;

const PAGE_SIZE = 12;
const SPARSE_ROW_THRESHOLD = 3;

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Gevorderd",
  advanced: "Expert",
};

function asList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((v) => v.split(","));
  return value.split(",");
}

function eurosToCents(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
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
        .filter((v): v is string => !!v)
    ),
  ];
  return values.sort();
}

function buildWorkshopsHref(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {}
) {
  const merged = { ...current, ...overrides };
  const query = new URLSearchParams();
  Object.entries(merged).forEach(([key, value]) => {
    if (value && value.trim() && value !== "all") {
      query.set(key, value);
    }
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
  const locationPreference = await getLocationPreference();

  const q = sanitizeAgendaSearchQuery(params.q) ?? undefined;
  const place = (params.place ?? params.city)?.trim() || null;
  const when =
    params.when === "today" ||
    params.when === "weekend" ||
    params.when === "next_week" ||
    params.when === "month"
      ? params.when
      : null;

  const customRange =
    !when && (params.from || params.to)
      ? resolveAgendaCustomRange(params.from, params.to)
      : null;
  const presetRange = when ? resolveAgendaDatePreset(when) : null;
  const dateRange = customRange ?? presetRange;

  const sort =
    params.sort === "near" || params.sort === "price_asc" ? params.sort : "soon";

  const difficulty = params.difficulty?.trim() || undefined;
  const format = params.format?.trim() || undefined;

  const extendedFilters = WORKSHOP_EXTENDED_TAXONOMY_FILTERS_ENABLED
    ? {
        offer_type: params.offer && isWorkshopOfferType(params.offer)
          ? params.offer
          : undefined,
        audience: parseWorkshopCodeList(
          asList(params.audience),
          isWorkshopAudienceType
        ),
        age: parseWorkshopCodeList(asList(params.age), isWorkshopAgeGroup),
        language: parseWorkshopCodeList(
          asList(params.language),
          isWorkshopLanguage
        ),
      }
    : {};

  const offset = (page - 1) * PAGE_SIZE;

  const [domains, discovery, cities, countries, categories] = await Promise.all([
    listActiveDomains(),
    listDiscoveryWorkshops({
      q,
      place: place ?? undefined,
      domain_id: params.domain,
      category_id: params.category,
      difficulty_level: difficulty,
      format_type: format,
      ...extendedFilters,
      price_min_cents: eurosToCents(params.price_min),
      price_max_cents: eurosToCents(params.price_max),
      from_iso: dateRange?.from,
      to_iso: dateRange?.to,
      country_code: params.country,
      preferred_city: !place ? locationPreference.city ?? undefined : undefined,
      preferred_country_code: !place
        ? locationPreference.countryCode ?? undefined
        : undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
    getUniqueWorkshopValues("city"),
    getUniqueWorkshopValues("country_code"),
    params.domain
      ? listWorkshopCategories({ domainId: params.domain, activeOnly: true })
      : Promise.resolve([]),
  ]);

  const { workshops: pagedWorkshops, totalCount, domainIds } = discovery;
  const hasNextPage = offset + PAGE_SIZE < totalCount;

  const chipDomainIds = resolveHobbyChipDomainIds({
    resultDomainIds: domainIds,
    selectedDomainId: params.domain,
    allDomainIdsOrdered: domains.map((d) => d.id),
  });
  const chipDomains = domains.filter((d) => chipDomainIds.includes(d.id));

  const groupMode = customRange ? "custom" : "preset";
  const groups = groupWorkshopsByDiscoveryBucket(pagedWorkshops, {
    mode: groupMode,
  });
  const useRows = totalCount > 0 && totalCount <= SPARSE_ROW_THRESHOLD;

  const current: Record<string, string | undefined> = {
    q: q ?? undefined,
    place: place ?? undefined,
    when: when ?? undefined,
    domain: params.domain,
    category: params.category,
    difficulty,
    format,
    from: !when ? params.from : undefined,
    to: !when ? params.to : undefined,
    country: params.country,
    price_min: params.price_min,
    price_max: params.price_max,
    sort: sort === "soon" ? undefined : sort,
  };

  const currentHref = buildWorkshopsHref(current, {
    page: page > 1 ? String(page) : undefined,
  });

  const buildHref = (overrides: Record<string, string | undefined>) =>
    buildWorkshopsHref(current, overrides);
  const hrefForDomain = (domainId?: string) =>
    buildWorkshopsHref(current, {
      domain: domainId,
      category: undefined,
      page: undefined,
    });
  const hrefForCategory = (categoryId?: string) =>
    buildWorkshopsHref(current, { category: categoryId, page: undefined });
  const hrefForPage = (target: number) =>
    buildWorkshopsHref(current, {
      page: target > 1 ? String(target) : undefined,
    });

  const placeLabel = place
    ? formatAgendaPlaceLabel({ place, mode: "in" })
    : null;

  const chips: FilterChip[] = [];
  if (q) {
    chips.push({
      label: `Zoek: ${q}`,
      removeHref: buildWorkshopsHref(current, { q: undefined, page: undefined }),
    });
  }
  if (place) {
    chips.push({
      label: placeLabel ?? place,
      removeHref: buildWorkshopsHref(current, {
        place: undefined,
        page: undefined,
      }),
    });
  }
  if (when) {
    const whenLabels: Record<string, string> = {
      today: "Vandaag",
      weekend: "Dit weekend",
      next_week: "Volgende week",
      month: "Deze maand",
    };
    chips.push({
      label: whenLabels[when] ?? when,
      removeHref: buildWorkshopsHref(current, {
        when: undefined,
        page: undefined,
      }),
    });
  }
  if (customRange && params.from) {
    chips.push({
      label: params.to ? `${params.from} – ${params.to}` : `Vanaf ${params.from}`,
      removeHref: buildWorkshopsHref(current, {
        from: undefined,
        to: undefined,
        page: undefined,
      }),
    });
  }
  if (params.domain) {
    chips.push({
      label: domains.find((d) => d.id === params.domain)?.name ?? "Hobby",
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
  if (difficulty) {
    chips.push({
      label: DIFFICULTY_LABELS[difficulty] ?? difficulty,
      removeHref: buildWorkshopsHref(current, {
        difficulty: undefined,
        page: undefined,
      }),
    });
  }
  if (format) {
    chips.push({
      label: format === "online" ? "Online" : format,
      removeHref: buildWorkshopsHref(current, {
        format: undefined,
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
  if (params.price_min || params.price_max) {
    chips.push({
      label: `Prijs ${params.price_min ?? "…"}–${params.price_max ?? "…"}`,
      removeHref: buildWorkshopsHref(current, {
        price_min: undefined,
        price_max: undefined,
        page: undefined,
      }),
    });
  }

  const hasExtraFilters = Boolean(
    params.country || params.price_min || params.price_max
  );

  const resultsTitle = place
    ? `Workshops in ${place}`
    : "Workshops";

  return (
    <Container className="py-8">
      <WorkshopsHero
        defaultQuery={params.q}
        hiddenFields={{
          place: place ?? undefined,
          when: when ?? undefined,
          from: !when ? params.from : undefined,
          to: !when ? params.to : undefined,
          domain: params.domain,
          category: params.category,
          difficulty,
          format,
          country: params.country,
          price_min: params.price_min,
          price_max: params.price_max,
          sort: sort === "soon" ? undefined : sort,
        }}
      />

      <WorkshopsQuickFilters
        placeLabel={placeLabel}
        placeValue={place}
        activeWhen={when}
        customFrom={!when ? params.from : undefined}
        customTo={!when ? params.to : undefined}
        beginnerActive={difficulty === "beginner"}
        onlineActive={format === "online"}
        buildHref={buildHref}
        currentHref={currentHref}
        cities={cities}
        savedRegionLabel={
          locationPreference.hasPreference ? locationPreference.city : null
        }
      />

      <WorkshopsHobbyChips
        domains={chipDomains}
        activeDomainId={params.domain}
        hrefForDomain={hrefForDomain}
        categories={categories}
        activeCategoryId={params.category}
        hrefForCategory={hrefForCategory}
      />

      <WorkshopsResultsHeader
        title={resultsTitle}
        totalCount={totalCount}
        controlsSlot={
          <>
            <WorkshopsSortControl activeSort={sort} buildHref={buildHref} />
            <WorkshopsFilterBar
              activeDifficulty={difficulty}
              activeCountry={params.country}
              priceMin={params.price_min}
              priceMax={params.price_max}
              countries={countries}
              buildHref={buildHref}
              clearHref="/workshops"
              hasExtraFilters={hasExtraFilters}
            />
          </>
        }
      />

      <ActiveFilterChips chips={chips} clearHref="/workshops" />

      {totalCount === 0 ? (
        <WorkshopsEmptyActions
          hasAnyResults={false}
          hasPlaceFilter={Boolean(place)}
          broaderPlaceHref={
            place
              ? buildWorkshopsHref(current, { place: undefined, page: undefined })
              : null
          }
          belgiumHref={buildWorkshopsHref(
            {
              q: q ?? undefined,
              when: when ?? undefined,
              from: !when ? params.from : undefined,
              to: !when ? params.to : undefined,
              domain: params.domain,
              category: params.category,
              difficulty,
              format,
            },
            { place: undefined, country: undefined, page: undefined }
          )}
        />
      ) : (
        <>
          <WorkshopsGroupedList groups={groups} useRows={useRows} />
          <MaterialsPagination
            page={page}
            hasNextPage={hasNextPage}
            hrefForPage={hrefForPage}
          />
          <WorkshopsEmptyActions
            hasAnyResults
            hasPlaceFilter={Boolean(place)}
            broaderPlaceHref={
              place
                ? buildWorkshopsHref(current, {
                    place: undefined,
                    page: undefined,
                  })
                : null
            }
            belgiumHref={buildWorkshopsHref(current, {
              place: undefined,
              country: undefined,
              page: undefined,
            })}
          />
        </>
      )}
    </Container>
  );
}
