import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import { listWorkshopsByDomain } from "@/lib/platform/queries/workshops";
import { WorkshopCard } from "@/components/cards";
import { DomainSubListingShell } from "@/components/domain/DomainSubListingShell";
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

  let lead: string | undefined;
  if (workshops.length > 0) {
    const count = `${workshops.length} workshop${workshops.length !== 1 ? "s" : ""}`;
    lead = locationPreference.hasPreference
      ? `${count}, lokale prioriteit voor ${locationPreference.label}`
      : count;
  } else if (locationPreference.hasPreference) {
    lead = `Lokale prioriteit actief voor ${locationPreference.label}.`;
  }

  return (
    <DomainSubListingShell
      domain={domain}
      title="Workshops"
      lead={lead}
      breadcrumbLabel="Workshops"
    >
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
    </DomainSubListingShell>
  );
}
