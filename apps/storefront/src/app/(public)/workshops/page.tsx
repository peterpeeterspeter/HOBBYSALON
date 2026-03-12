import { Suspense } from "react";
import Link from "next/link";
import { listAllWorkshops } from "@/lib/platform/queries/workshops";
import { createPlatformClient } from "@/lib/platform/client";
import { WorkshopCard } from "@/components/cards";
import { getLocationPreference } from "@/lib/location/preference";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workshops | Hobbysalon",
  description: "Ontdek en boek workshops voor je hobby",
};

type SearchParams = Promise<{
  domain?: string;
  difficulty?: string;
  format?: string;
  city?: string;
  country?: string;
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

async function getUniqueWorkshopCities(): Promise<string[]> {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("workshops")
    .select("city")
    .eq("is_active", true)
    .not("city", "is", null);

  const cities = [
    ...new Set(
      (data ?? [])
        .map((row) => (row as { city: string | null }).city)
        .filter((city): city is string => !!city)
    ),
  ];

  return cities.sort();
}

async function getUniqueWorkshopCountries(): Promise<string[]> {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("workshops")
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

async function WorkshopsContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const locationPreference = await getLocationPreference();
  const workshops = await listAllWorkshops({
    domain_id: params.domain,
    difficulty_level: params.difficulty,
    format_type: params.format,
    city: params.city,
    country_code: params.country,
    preferred_city: locationPreference.city ?? undefined,
    preferred_country_code: locationPreference.countryCode ?? undefined,
  });
  const [domains, cities, countries] = await Promise.all([
    getDomains(),
    getUniqueWorkshopCities(),
    getUniqueWorkshopCountries(),
  ]);

  const formatTypeOptions = [
    { value: "physical", label: "Fysiek" },
    { value: "online", label: "Online" },
    { value: "hybrid", label: "Hybride" },
  ];

  const difficultyOptions = [
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Gevorderd" },
    { value: "advanced", label: "Expert" },
  ];

  return (
    <Container className="py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
          Workshops
        </h1>
        <p className="text-lg text-[var(--muted)]">
          Leer nieuwe technieken van ervaren instructeurs
        </p>
        {locationPreference.hasPreference && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--card)] px-3 py-1 text-sm text-[var(--foreground)]">
              Lokale prioriteit: {locationPreference.label}
            </span>
            {locationPreference.city && (
              <Link
                href={`/workshops?city=${encodeURIComponent(locationPreference.city)}`}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Alleen {locationPreference.city}
              </Link>
            )}
            <Link
              href="/workshops"
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Reset filters
            </Link>
          </div>
        )}
      </header>

      <CardShell variant="default" padding="lg" className="mb-8">
        <h2 className="font-semibold text-[var(--foreground)] mb-4">Filters</h2>
        <form method="GET" action="/workshops" className="grid gap-4 sm:grid-cols-6">
          <Select
            id="domain"
            name="domain"
            label="Domein"
            placeholder="Alle domeinen"
            options={domains.map((d) => ({ value: d.id, label: d.name }))}
            defaultValue={params.domain ?? ""}
          />
          <Select
            id="format"
            name="format"
            label="Format"
            placeholder="Alle formats"
            options={formatTypeOptions}
            defaultValue={params.format ?? ""}
          />
          <Select
            id="difficulty"
            name="difficulty"
            label="Niveau"
            placeholder="Alle niveaus"
            options={difficultyOptions}
            defaultValue={params.difficulty ?? ""}
          />
          <Select
            id="city"
            name="city"
            label="Stad"
            placeholder="Alle steden"
            options={cities.map((city) => ({ value: city, label: city }))}
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
          <div className="flex items-end">
            <Button type="submit" fullWidth>
              Filteren
            </Button>
          </div>
        </form>
      </CardShell>

      {workshops.length === 0 ? (
        <EmptyState
          image="emptySearch"
          title="Geen workshops gevonden"
          description="Geen workshops gevonden met deze filters."
          action={{ label: "Alle workshops bekijken", href: "/workshops" }}
        />
      ) : (
        <>
          <p className="mb-6 text-sm text-[var(--muted)]">
            {workshops.length} workshop{workshops.length !== 1 ? "s" : ""} gevonden
          </p>
          <GridLayout cols={3} gap="lg">
            {workshops.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </GridLayout>
        </>
      )}
    </Container>
  );
}

export default function WorkshopsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="text-center py-12">Laden...</div>}>
      <WorkshopsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
