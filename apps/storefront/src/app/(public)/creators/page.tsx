import type { Metadata } from "next";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { MaterialsPagination } from "@/components/materials/MaterialsPagination";
import { CreatorDiscoveryCard } from "@/components/creators/CreatorDiscoveryCard";
import { CreatorsAfterResults } from "@/components/creators/CreatorsAfterResults";
import { CreatorsFilterBar } from "@/components/creators/CreatorsFilterBar";
import { CreatorsHero } from "@/components/creators/CreatorsHero";
import { CreatorsHobbyChips } from "@/components/creators/CreatorsHobbyChips";
import { CreatorsIntentChips } from "@/components/creators/CreatorsIntentChips";
import { CreatorsToolbar } from "@/components/creators/CreatorsToolbar";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CREATOR_INTENT_CHIPS,
  resolveHobbyChipDomainIds,
  sanitizeAgendaSearchQuery,
  type CreatorIntent,
} from "@/lib/creators/creators-directory-helpers";
import { listCreatorsDirectory } from "@/lib/platform/queries/creators";
import { listActiveDomains } from "@/lib/platform/queries/domains";

export const metadata: Metadata = {
  title: "Makers | Hobbysalon",
  description:
    "Vind makers die bij jouw hobby passen: workshops, creaties, materialen of hobbymarkten",
};

type SearchParams = Promise<{
  q?: string;
  intent?: string;
  creator_type?: string;
  domain?: string;
  place?: string;
  sort?: string;
  page?: string;
}>;

const PAGE_SIZE = 24;

const INTENT_VALUES = new Set(
  CREATOR_INTENT_CHIPS.map((chip) => chip.intent)
);

function parseIntent(value?: string): CreatorIntent | null {
  const v = value?.trim().toLowerCase();
  if (v && INTENT_VALUES.has(v as CreatorIntent)) {
    return v as CreatorIntent;
  }
  return null;
}

/** Map legacy creator_type URL to intent when possible. */
function intentFromLegacyType(type?: string): CreatorIntent | null {
  const t = type?.trim().toLowerCase();
  if (t === "workshopgever") return "workshops";
  if (t === "maker") return "handmade";
  if (t === "supplier") return "materials";
  return null;
}

function buildCreatorsHref(
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
  return serialized ? `/creators?${serialized}` : "/creators";
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = sanitizeAgendaSearchQuery(params.q) ?? undefined;
  const intent =
    parseIntent(params.intent) ?? intentFromLegacyType(params.creator_type);
  const legacyCreatorType =
    !parseIntent(params.intent) && params.creator_type?.trim()
      ? params.creator_type.trim()
      : undefined;
  const domainFilter = params.domain?.trim() || undefined;
  const sort = params.sort === "newest" ? "newest" : "recommended";
  const placeParam = params.place?.trim() || undefined;

  const pageRaw = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const [domains, directory] = await Promise.all([
    listActiveDomains(),
    listCreatorsDirectory({
      q,
      domainId: domainFilter,
      intent: intent ?? undefined,
      creatorType: legacyCreatorType,
      place: placeParam,
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
  ]);

  const {
    creators,
    totalCount,
    domainIdsWithCreators,
    placeCoverage,
    uniqueCities,
  } = directory;

  const showPlaceFilter = placeCoverage.hasReliablePlaceFilter;
  const activePlace =
    showPlaceFilter && placeParam ? placeParam : undefined;
  const hasNextPage = offset + PAGE_SIZE < totalCount;

  const chipDomainIds = resolveHobbyChipDomainIds({
    domainIdsWithCreators,
    selectedDomainId: domainFilter,
    allDomainIdsOrdered: domains.map((d) => d.id),
  });
  const chipDomains = domains.filter((d) => chipDomainIds.includes(d.id));

  const current: Record<string, string | undefined> = {
    q: q ?? undefined,
    intent: intent ?? undefined,
    domain: domainFilter,
    place: activePlace,
    sort: sort === "recommended" ? undefined : sort,
  };

  const buildHref = (overrides: Record<string, string | undefined>) =>
    buildCreatorsHref(current, overrides);

  const hrefForDomain = (domainId?: string) =>
    buildCreatorsHref(current, { domain: domainId, page: undefined });

  const heroHidden: Record<string, string | undefined> = {
    intent: intent ?? undefined,
    domain: domainFilter,
    place: activePlace,
    sort: sort === "recommended" ? undefined : sort,
  };

  const chips: FilterChip[] = [];
  if (q) {
    chips.push({
      label: `"${q}"`,
      removeHref: buildHref({ q: undefined, page: undefined }),
    });
  }
  if (intent) {
    chips.push({
      label:
        CREATOR_INTENT_CHIPS.find((c) => c.intent === intent)?.label ?? intent,
      removeHref: buildHref({ intent: undefined, page: undefined }),
    });
  }
  if (domainFilter) {
    chips.push({
      label: domains.find((d) => d.id === domainFilter)?.name ?? "Hobby",
      removeHref: buildHref({ domain: undefined, page: undefined }),
    });
  }
  if (activePlace) {
    chips.push({
      label: activePlace,
      removeHref: buildHref({ place: undefined, page: undefined }),
    });
  }

  const hasFilters = Boolean(q || intent || domainFilter || activePlace);

  return (
    <>
      <CreatorsHero hiddenFields={heroHidden} defaultQuery={q} />

      <div className="border-b border-[var(--border)] bg-[var(--section-alt)]">
        <Container className="py-6 sm:py-8">
          <CreatorsIntentChips activeIntent={intent} buildHref={buildHref} />

          <CreatorsHobbyChips
            domains={chipDomains.length > 0 ? chipDomains : domains.slice(0, 12)}
            activeDomainId={domainFilter}
            hrefForDomain={hrefForDomain}
          />
        </Container>
      </div>

      <Container className="py-8 sm:py-10">
        <CreatorsToolbar
          totalCount={totalCount}
          activeSort={sort}
          buildHref={buildHref}
        />

        <CreatorsFilterBar
          domains={domains}
          activeDomainId={domainFilter}
          activeIntent={intent}
          activePlace={activePlace}
          cities={uniqueCities}
          showPlaceFilter={showPlaceFilter}
          buildHref={buildHref}
          clearHref="/creators"
          hasFilters={hasFilters}
        />

        <ActiveFilterChips chips={chips} clearHref="/creators" />

        {creators.length === 0 ? (
          <EmptyState
            title="Geen makers gevonden"
            description="Pas je filters aan of wis alle filters."
            action={{ label: "Alle makers", href: "/creators" }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {creators.map((creator) => (
              <CreatorDiscoveryCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}

        <MaterialsPagination
          page={page}
          hasNextPage={hasNextPage}
          hrefForPage={(p) =>
            buildHref({ page: p > 1 ? String(p) : undefined })
          }
        />

        <CreatorsAfterResults />
      </Container>
    </>
  );
}
