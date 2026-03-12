import { Suspense } from "react";
import Link from "next/link";
import { listEvents } from "@/lib/platform/queries/events";
import { createPlatformClient } from "@/lib/platform/client";
import { EventCard } from "@/components/cards";
import { getLocationPreference } from "@/lib/location/preference";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agenda | Hobbysalon",
  description: "Handmade markten, hobbybeurzen, pop-ups en workshops",
};

type SearchParams = Promise<{
  domain?: string;
  type?: string;
  city?: string;
  country?: string;
  from?: string;
  to?: string;
}>;

async function getDomains() {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("domains")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as Array<{ id: string; name: string; slug: string }>;
}

async function getUniqueCities(): Promise<string[]> {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("events")
    .select("city")
    .eq("is_active", true)
    .not("city", "is", null);
  const cities = [
    ...new Set(
      (data ?? [])
        .map((r) => (r as { city: string }).city)
        .filter((c): c is string => !!c)
    ),
  ];
  return cities.sort();
}

async function getUniqueCountries(): Promise<string[]> {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("events")
    .select("country_code")
    .eq("is_active", true)
    .not("country_code", "is", null);

  const countries = [
    ...new Set(
      (data ?? [])
        .map((row) => (row as { country_code: string | null }).country_code)
        .filter((country): country is string => !!country)
    ),
  ];

  return countries.sort();
}

async function AgendaContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const locationPreference = await getLocationPreference();
  const events = await listEvents({
    domain_id: params.domain,
    event_type: params.type,
    city: params.city,
    country_code: params.country,
    preferred_city: locationPreference.city ?? undefined,
    preferred_country_code: locationPreference.countryCode ?? undefined,
    from_date: params.from ?? new Date().toISOString(),
    to_date: params.to,
  });
  const [domains, cities, countries] = await Promise.all([
    getDomains(),
    getUniqueCities(),
    getUniqueCountries(),
  ]);

  const eventTypeOptions = [
    { value: "handmade_market", label: "Handmade markt" },
    { value: "hobby_fair", label: "Hobbybeurs" },
    { value: "pop_up", label: "Pop-up" },
    { value: "open_atelier", label: "Open atelier" },
    { value: "workshop_day", label: "Workshopdag" },
  ];

  return (
    <Container className="py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
          Agenda
        </h1>
        <p className="text-lg text-[var(--muted)]">
          Handmade markten, hobbybeurzen, pop-ups en meer
        </p>
        {locationPreference.hasPreference && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--card)] px-3 py-1 text-sm text-[var(--foreground)]">
              Lokale prioriteit: {locationPreference.label}
            </span>
            {locationPreference.city && (
              <Link
                href={`/agenda?city=${encodeURIComponent(locationPreference.city)}`}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Alleen {locationPreference.city}
              </Link>
            )}
            <Link
              href="/agenda"
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Reset filters
            </Link>
          </div>
        )}
      </header>

      <div className="mb-8 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="font-semibold text-[var(--foreground)]">Filters</h2>
        <form method="GET" action="/agenda" className="grid gap-4 sm:grid-cols-6">
          <div>
            <label
              htmlFor="domain"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Domein
            </label>
            <select
              id="domain"
              name="domain"
              defaultValue={params.domain ?? ""}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">Alle domeinen</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue={params.type ?? ""}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">Alle types</option>
              {eventTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Stad
            </label>
            <select
              id="city"
              name="city"
              defaultValue={params.city ?? ""}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">Alle steden</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="country"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Regio (land)
            </label>
            <select
              id="country"
              name="country"
              defaultValue={params.country ?? ""}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">Alle landen</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="from"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Vanaf
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={params.from ?? new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--accent)] px-6 py-2 font-semibold text-[var(--accent-foreground)] hover:opacity-90"
            >
              Filteren
            </button>
          </div>
        </form>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="Geen evenementen gevonden"
          description="Geen evenementen gevonden met deze filters."
          action={{ label: "Alle evenementen bekijken", href: "/agenda" }}
        />
      ) : (
        <>
          <p className="mb-6 text-sm text-[var(--muted)]">
            {events.length} evenement{events.length !== 1 ? "en" : ""} gevonden
          </p>
          <GridLayout cols={3} gap="lg">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </GridLayout>
        </>
      )}
    </Container>
  );
}

export default function AgendaPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="text-center py-12">Laden...</div>}>
      <AgendaContent searchParams={props.searchParams} />
    </Suspense>
  );
}
