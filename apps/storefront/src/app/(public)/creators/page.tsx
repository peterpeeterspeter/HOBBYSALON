import type { Metadata } from "next";
import { listAllCreators } from "@/lib/platform/queries/creators";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { CreatorCard } from "@/components/cards";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryCircles } from "@/components/materials/CategoryCircles";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { CreatorsSidebar } from "@/components/creators/CreatorsSidebar";

export const metadata: Metadata = {
  title: "Makers | Hobbysalon",
  description: "Ontdek makers, leveranciers en workshopleiders",
};

type SearchParams = Promise<{
  q?: string;
  domain?: string;
  creator_type?: string;
}>;

const TYPE_LABELS: Record<string, string> = {
  maker: "Maker",
  workshopgever: "Workshopgever",
  supplier: "Leverancier",
  content_creator: "Content maker",
  organizer: "Organisator",
};

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
  const domainFilter = params.domain?.trim() || undefined;
  const typeFilter =
    params.creator_type && params.creator_type !== "all"
      ? params.creator_type
      : undefined;

  const [domains, creators] = await Promise.all([
    listActiveDomains(),
    listAllCreators({
      domainId: domainFilter,
      creatorType: typeFilter,
      q: params.q?.trim() || undefined,
    }),
  ]);

  const current = {
    q: params.q,
    domain: params.domain,
    creator_type: params.creator_type,
  };

  const hrefForDomain = (domainId?: string) =>
    buildCreatorsHref(current, { domain: domainId });

  const chips: FilterChip[] = [];
  if (params.q) {
    chips.push({
      label: `"${params.q}"`,
      removeHref: buildCreatorsHref(current, { q: undefined }),
    });
  }
  if (domainFilter) {
    chips.push({
      label: domains.find((d) => d.id === domainFilter)?.name ?? "Domein",
      removeHref: buildCreatorsHref(current, { domain: undefined }),
    });
  }
  if (typeFilter) {
    chips.push({
      label: TYPE_LABELS[typeFilter] ?? typeFilter,
      removeHref: buildCreatorsHref(current, { creator_type: undefined }),
    });
  }

  return (
    <Container className="py-8">
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
          Makers
        </h1>
        <p className="mt-1 text-lg text-[var(--muted)]">
          Makers, leveranciers en workshopgevers van de Hobbysalon community.
        </p>
      </header>

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        <CreatorsSidebar
          domains={domains}
          params={{
            q: params.q,
            domain: params.domain,
            creator_type: params.creator_type,
          }}
        />

        <div className="min-w-0 flex-1">
          <CategoryCircles
            domains={domains}
            activeDomain={domainFilter}
            hrefForDomain={hrefForDomain}
          />

          <ActiveFilterChips chips={chips} clearHref="/creators" />

          <div className="mb-5 flex items-center justify-between rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <p className="text-[15px] text-[var(--muted)]">
              <strong className="font-bold text-[var(--foreground)]">{creators.length}</strong>{" "}
              creator{creators.length === 1 ? "" : "s"} gevonden
            </p>
          </div>

          {creators.length === 0 ? (
            <EmptyState
              title="Geen creators gevonden"
              description="Pas je filters aan of wis alle filters."
              action={{ label: "Alle creators", href: "/creators" }}
            />
          ) : (
            <GridLayout cols={3} gap="lg">
              {creators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </GridLayout>
          )}
        </div>
      </div>
    </Container>
  );
}
