import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import { listWorkshopsByDomain } from "@/lib/platform/queries/workshops";
import { WorkshopCard } from "@/components/cards";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { getLocationPreference } from "@/lib/location/preference";

type Props = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ city?: string; country?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  if (!domain) return { title: "Niet gevonden" };
  return {
    title: `${domain.name} workshops | Hobbysalon`,
    description: domain.short_description ?? undefined,
  };
}

export default async function DomainWorkshopsPage({ params, searchParams }: Props) {
  const { domain: slug } = await params;
  const filters = await searchParams;
  const domain = await getDomainBySlug(slug);
  if (!domain) notFound();

  const locationPreference = await getLocationPreference();
  const workshops = await listWorkshopsByDomain(domain.id, {
    city: filters.city,
    country_code: filters.country,
    preferred_city: locationPreference.city ?? undefined,
    preferred_country_code: locationPreference.countryCode ?? undefined,
  });

  return (
    <Container className="py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/${domain.slug}`} className="hover:text-[var(--foreground)]">
              {domain.name}
            </Link>
          </li>
          <li>/</li>
          <li className="text-[var(--foreground)]">Workshops</li>
        </ol>
      </nav>

      <header className="mb-8">
        <p className="mb-1 text-sm font-bold uppercase tracking-wider text-[var(--accent)]">
          {domain.name}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">
          Workshops
        </h1>
        {workshops.length > 0 && (
          <p className="mt-1 text-[var(--muted)]">
            {workshops.length} workshop{workshops.length !== 1 ? "s" : ""}
            {locationPreference.hasPreference &&
              ` · lokale prioriteit voor ${locationPreference.label}`}
          </p>
        )}
        {locationPreference.hasPreference && !workshops.length && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Lokale prioriteit actief voor {locationPreference.label}.
          </p>
        )}
      </header>

      {workshops.length === 0 ? (
        <EmptyState
          title="Nog geen workshops"
          description="Nog geen workshops in dit domein."
          action={{ label: `Terug naar ${domain.name}`, href: `/${domain.slug}` }}
        />
      ) : (
        <GridLayout cols={3} gap="lg">
          {workshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} />
          ))}
        </GridLayout>
      )}
    </Container>
  );
}
