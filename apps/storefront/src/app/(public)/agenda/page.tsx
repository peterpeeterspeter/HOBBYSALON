import { Suspense } from "react";
import Link from "next/link";
import { listEvents } from "@/lib/platform/queries/events";
import { createPlatformClient } from "@/lib/platform/client";
import { EventCard } from "@/components/cards";
import { getLocationPreference } from "@/lib/location/preference";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

      <CardShell variant="default" padding="lg" className="mb-8">
        <h2 className="font-semibold text-[var(--foreground)] mb-4">Filters</h2>
        <form method="GET" action="/agenda" className="grid gap-4 sm:grid-cols-6">
          <Select
            id="domain"
            name="domain"
            label="Domein"
            placeholder="Alle domeinen"
            options={domains.map((d) => ({ value: d.id, label: d.name }))}
            defaultValue={params.domain ?? ""}
          />
          <Select
            id="type"
            name="type"
            label="Type"
            placeholder="Alle types"
            options={eventTypeOptions}
            defaultValue={params.type ?? ""}
          />
          <Select
            id="city"
            name="city"
            label="Stad"
            placeholder="Alle steden"
            options={cities.map((c) => ({ value: c, label: c }))}
            defaultValue={params.city ?? ""}
          />
          <Select
            id="country"
            name="country"
            label="Regio (land)"
            placeholder="Alle landen"
            options={countries.map((country) => ({ value: country, label: country }))}
            defaultValue={params.country ?? ""}
          />
          <Input
            id="from"
            name="from"
            type="date"
            label="Vanaf"
            defaultValue={params.from ?? new Date().toISOString().slice(0, 10)}
          />
          <div className="flex items-end">
            <Button type="submit" fullWidth>
              Filteren
            </Button>
          </div>
        </form>
      </CardShell>

      {events.length === 0 ? (
        <EmptyState
          image="emptySearch"
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
