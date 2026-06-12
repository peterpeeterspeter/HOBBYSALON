import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryCircles } from "@/components/materials/CategoryCircles";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { MaterialsPagination } from "@/components/materials/MaterialsPagination";
import { AgendaSidebar } from "@/components/events/AgendaSidebar";
import { getLocationPreference } from "@/lib/location/preference";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { listEvents } from "@/lib/platform/queries/events";
import { createPlatformClient } from "@/lib/platform/client";

export const metadata: Metadata = {
  title: "Agenda | Hobbysalon",
  description:
    "Handmade markten, hobbybeurzen, pop-ups en workshops bij jou in de buurt",
};

type SearchParams = Promise<{
  domain?: string;
  type?: string;
  city?: string;
  country?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
}>;

const PAGE_SIZE = 12;

const EVENT_TYPE_LABELS: Record<string, string> = {
  handmade_market: "Handmade markt",
  hobby_fair: "Hobbybeurs",
  pop_up: "Pop-up",
  open_atelier: "Open atelier",
  workshop_day: "Workshopdag",
};

async function getUniqueEventValues(
  column: "city" | "country_code"
): Promise<string[]> {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("events")
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

function buildAgendaHref(
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
  return serialized ? `/agenda?${serialized}` : "/agenda";
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const pageRaw = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const locationPreference = await getLocationPreference();

  const todayIso = new Date().toISOString();
  const fromDate = params.from
    ? new Date(params.from).toISOString()
    : todayIso;
  const toDate = params.to ? new Date(params.to).toISOString() : undefined;

  const [domains, events, cities, countries] = await Promise.all([
    listActiveDomains(),
    listEvents({
      domain_id: params.domain,
      event_type: params.type,
      city: params.city,
      country_code: params.country,
      from_date: fromDate,
      to_date: toDate,
      preferred_city: locationPreference.city ?? undefined,
      preferred_country_code: locationPreference.countryCode ?? undefined,
    }),
    getUniqueEventValues("city"),
    getUniqueEventValues("country_code"),
  ]);

  const totalCount = events.length;
  const offset = (page - 1) * PAGE_SIZE;
  const pagedEvents = events.slice(offset, offset + PAGE_SIZE);
  const hasNextPage = offset + PAGE_SIZE < totalCount;

  const current = {
    domain: params.domain,
    type: params.type,
    city: params.city,
    country: params.country,
    from: params.from,
    to: params.to,
    sort: params.sort,
  };

  const hrefForDomain = (domainId?: string) =>
    buildAgendaHref(current, { domain: domainId, page: undefined });
  const hrefForPage = (target: number) =>
    buildAgendaHref(current, { page: target > 1 ? String(target) : undefined });

  const chips: FilterChip[] = [];
  if (params.domain) {
    chips.push({
      label: domains.find((d) => d.id === params.domain)?.name ?? "Domein",
      removeHref: buildAgendaHref(current, { domain: undefined, page: undefined }),
    });
  }
  if (params.type) {
    chips.push({
      label: EVENT_TYPE_LABELS[params.type] ?? params.type,
      removeHref: buildAgendaHref(current, { type: undefined, page: undefined }),
    });
  }
  if (params.city) {
    chips.push({
      label: params.city,
      removeHref: buildAgendaHref(current, { city: undefined, page: undefined }),
    });
  }
  if (params.country) {
    chips.push({
      label: params.country,
      removeHref: buildAgendaHref(current, { country: undefined, page: undefined }),
    });
  }
  if (params.from) {
    chips.push({
      label: `Vanaf ${params.from}`,
      removeHref: buildAgendaHref(current, { from: undefined, page: undefined }),
    });
  }
  if (params.to) {
    chips.push({
      label: `Tot ${params.to}`,
      removeHref: buildAgendaHref(current, { to: undefined, page: undefined }),
    });
  }

  return (
    <Container className="py-8">
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
          Agenda
        </h1>
        <p className="mt-1 text-lg text-[var(--muted)]">
          Handmade markten, hobbybeurzen, pop-ups en meer bij jou in de buurt.
        </p>
        {locationPreference.hasPreference && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--card)] px-3 py-1 text-sm text-[var(--foreground)]">
              Lokale prioriteit: {locationPreference.label}
            </span>
            <Link
              href="/agenda"
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Reset filters
            </Link>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        <AgendaSidebar
          domains={domains}
          cities={cities}
          countries={countries}
          params={{
            domain: params.domain,
            type: params.type,
            city: params.city,
            country: params.country,
            from: params.from,
            to: params.to,
            sort: params.sort,
          }}
        />

        <div className="min-w-0 flex-1">
          <CategoryCircles
            domains={domains}
            activeDomain={params.domain}
            hrefForDomain={hrefForDomain}
          />

          <ActiveFilterChips chips={chips} clearHref="/agenda" />

          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-[15px] text-[var(--muted)]">
              {totalCount === 0
                ? "Geen evenementen gevonden"
                : `${totalCount} evenement${totalCount !== 1 ? "en" : ""}`}
            </p>
          </div>

          {pagedEvents.length === 0 ? (
            <EmptyState
              image="emptySearch"
              title="Geen evenementen gevonden"
              description="Pas je filters aan of bekijk alle komende evenementen."
              action={{ label: "Alle evenementen", href: "/agenda" }}
            />
          ) : (
            <GridLayout cols={3} gap="lg">
              {pagedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
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
