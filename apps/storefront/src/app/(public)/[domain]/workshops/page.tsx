import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import { listWorkshopsByDomain } from "@/lib/platform/queries/workshops";
import { WorkshopCard } from "@/components/cards";
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
    <div className="mx-auto max-w-6xl px-4 py-8">
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
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          {domain.name} workshops
        </h1>
        {locationPreference.hasPreference && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Lokale prioriteit actief voor {locationPreference.label}.
          </p>
        )}
      </header>

      {workshops.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-12 text-center text-[var(--muted)]">
          Nog geen workshops in dit domein.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} />
          ))}
        </div>
      )}
    </div>
  );
}
