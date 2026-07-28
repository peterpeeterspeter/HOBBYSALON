import type { Metadata } from "next";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { MaterialsPagination } from "@/components/materials/MaterialsPagination";
import { Container } from "@/components/ui/container";
import { AgendaHero } from "@/components/events/AgendaHero";
import { AgendaQuickFilters } from "@/components/events/AgendaQuickFilters";
import { AgendaHobbyChips } from "@/components/events/AgendaHobbyChips";
import { AgendaFilterBar, AGENDA_EVENT_TYPE_OPTIONS } from "@/components/events/AgendaFilterBar";
import { AgendaResultsHeader } from "@/components/events/AgendaResultsHeader";
import { AgendaGroupedList } from "@/components/events/AgendaGroupedList";
import { AgendaEmptyActions } from "@/components/events/AgendaEmptyActions";
import {
  formatAgendaPlaceLabel,
  groupEventsByAgendaBucket,
  resolveAgendaCustomRange,
  resolveAgendaDatePreset,
  sanitizeAgendaSearchQuery,
} from "@/lib/agenda/agenda-helpers";
import { getLocationPreference } from "@/lib/location/preference";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { listAgendaEvents } from "@/lib/platform/queries/events";
import { createPlatformClient } from "@/lib/platform/client";

export const metadata: Metadata = {
  title: "Agenda | Hobbysalon",
  description:
    "Handmade markten, hobbybeurzen, pop-ups en workshops bij jou in de buurt",
};

type SearchParams = Promise<{
  q?: string;
  near?: string;
  when?: string;
  domain?: string;
  type?: string;
  city?: string;
  country?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

const PAGE_SIZE = 12;
const SPARSE_ROW_THRESHOLD = 3;

const EVENT_TYPE_LABELS = Object.fromEntries(
  AGENDA_EVENT_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

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

  const q = sanitizeAgendaSearchQuery(params.q) ?? undefined;
  // Place for this search only — never auto-write preferences.
  const near =
    (params.near ?? params.city)?.trim() || null;
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

  const offset = (page - 1) * PAGE_SIZE;

  const [domains, agendaResult, cities, countries] = await Promise.all([
    listActiveDomains(),
    listAgendaEvents({
      domain_id: params.domain,
      event_type: params.type,
      near: near ?? undefined,
      country_code: params.country,
      q,
      from_date: dateRange?.from,
      to_date: dateRange?.to,
      upcoming_only: true,
      preferred_city: !near ? locationPreference.city ?? undefined : undefined,
      preferred_country_code: !near
        ? locationPreference.countryCode ?? undefined
        : undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    getUniqueEventValues("city"),
    getUniqueEventValues("country_code"),
  ]);

  const { events: pagedEvents, totalCount } = agendaResult;
  const hasNextPage = offset + PAGE_SIZE < totalCount;

  // Grouping needs the page slice; for sparse totals fetch is already the full set when ≤ PAGE_SIZE.
  // When totalCount is small, use rows; group the current page.
  const groupMode = customRange ? "custom" : "preset";
  const groups = groupEventsByAgendaBucket(pagedEvents, { mode: groupMode });
  const useRows = totalCount > 0 && totalCount <= SPARSE_ROW_THRESHOLD;

  const current: Record<string, string | undefined> = {
    q: q ?? undefined,
    near: near ?? undefined,
    when: when ?? undefined,
    domain: params.domain,
    type: params.type,
    country: params.country,
    from: !when ? params.from : undefined,
    to: !when ? params.to : undefined,
  };

  const currentHref = buildAgendaHref(current, {
    page: page > 1 ? String(page) : undefined,
  });

  const hrefForDomain = (domainId?: string) =>
    buildAgendaHref(current, { domain: domainId, page: undefined });
  const hrefForPage = (target: number) =>
    buildAgendaHref(current, { page: target > 1 ? String(target) : undefined });
  const buildHref = (overrides: Record<string, string | undefined>) =>
    buildAgendaHref(current, overrides);

  const placeLabel = near
    ? formatAgendaPlaceLabel({ place: near, mode: "in" })
    : null;

  const chips: FilterChip[] = [];
  if (q) {
    chips.push({
      label: `Zoek: ${q}`,
      removeHref: buildAgendaHref(current, { q: undefined, page: undefined }),
    });
  }
  if (near) {
    chips.push({
      label: placeLabel ?? near,
      removeHref: buildAgendaHref(current, { near: undefined, page: undefined }),
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
      removeHref: buildAgendaHref(current, { when: undefined, page: undefined }),
    });
  }
  if (customRange && params.from) {
    chips.push({
      label: params.to ? `${params.from} – ${params.to}` : `Vanaf ${params.from}`,
      removeHref: buildAgendaHref(current, {
        from: undefined,
        to: undefined,
        page: undefined,
      }),
    });
  }
  if (params.domain) {
    chips.push({
      label: domains.find((d) => d.id === params.domain)?.name ?? "Hobby",
      removeHref: buildAgendaHref(current, { domain: undefined, page: undefined }),
    });
  }
  if (params.type) {
    chips.push({
      label: EVENT_TYPE_LABELS[params.type] ?? params.type,
      removeHref: buildAgendaHref(current, { type: undefined, page: undefined }),
    });
  }
  if (params.country) {
    chips.push({
      label: params.country,
      removeHref: buildAgendaHref(current, {
        country: undefined,
        page: undefined,
      }),
    });
  }

  const hasExtraFilters = Boolean(params.country || params.type || params.domain || q);

  return (
    <Container className="py-8">
      <AgendaHero
        defaultQuery={params.q}
        hiddenFields={{
          near: near ?? undefined,
          when: when ?? undefined,
          from: !when ? params.from : undefined,
          to: !when ? params.to : undefined,
          domain: params.domain,
          type: params.type,
          country: params.country,
        }}
      />

      <AgendaQuickFilters
        placeLabel={placeLabel}
        placeValue={near}
        activeWhen={when}
        customFrom={!when ? params.from : undefined}
        customTo={!when ? params.to : undefined}
        buildHref={buildHref}
        currentHref={currentHref}
        cities={cities}
        savedRegionLabel={
          locationPreference.hasPreference ? locationPreference.city : null
        }
      />

      <AgendaHobbyChips
        domains={domains}
        activeDomainId={params.domain}
        hrefForDomain={hrefForDomain}
      />

      <AgendaResultsHeader
        totalCount={totalCount}
        filtersSlot={
          <AgendaFilterBar
            activeType={params.type}
            activeCountry={params.country}
            countries={countries}
            buildHref={buildHref}
            clearHref="/agenda"
            hasExtraFilters={hasExtraFilters}
          />
        }
      />

      <ActiveFilterChips chips={chips} clearHref="/agenda" />

      {totalCount === 0 ? (
        <AgendaEmptyActions
          hasAnyResults={false}
          hasPlaceFilter={Boolean(near)}
          broaderPlaceHref={
            near
              ? buildAgendaHref(current, { near: undefined, page: undefined })
              : null
          }
          belgiumHref={buildAgendaHref(
            {
              q: q ?? undefined,
              when: when ?? undefined,
              from: !when ? params.from : undefined,
              to: !when ? params.to : undefined,
              domain: params.domain,
              type: params.type,
            },
            { near: undefined, country: undefined, page: undefined }
          )}
        />
      ) : (
        <>
          <AgendaGroupedList groups={groups} useRows={useRows} />
          <MaterialsPagination
            page={page}
            hasNextPage={hasNextPage}
            hrefForPage={hrefForPage}
          />
          <AgendaEmptyActions
            hasAnyResults
            hasPlaceFilter={Boolean(near)}
            broaderPlaceHref={
              near
                ? buildAgendaHref(current, { near: undefined, page: undefined })
                : null
            }
            belgiumHref={buildAgendaHref(current, {
              near: undefined,
              country: undefined,
              page: undefined,
            })}
          />
        </>
      )}
    </Container>
  );
}
