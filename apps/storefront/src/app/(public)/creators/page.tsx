import Link from "next/link";
import { listAllCreators } from "@/lib/platform/queries/creators";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { CreatorCard } from "@/components/cards";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creators | Hobbysalon",
  description: "Ontdek makers, leveranciers en workshopleiders",
};

const CREATOR_TYPE_OPTIONS = [
  { value: "all", label: "Alle types" },
  { value: "maker", label: "Maker" },
  { value: "workshopgever", label: "Workshopgever" },
  { value: "supplier", label: "Leverancier" },
  { value: "content_creator", label: "Content maker" },
  { value: "organizer", label: "Organisator" },
];

type Props = {
  searchParams: Promise<{
    domain?: string;
    creator_type?: string;
    q?: string;
  }>;
};

export default async function CreatorsPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedDomain = params.domain ?? "all";
  const selectedCreatorType = params.creator_type ?? "all";
  const searchQuery = params.q?.trim() ?? "";

  const domains = await listDomainsBySort();
  const domainOptions = [
    { value: "all", label: "Alle domeinen" },
    ...domains.map((domain) => ({
      value: domain.id,
      label: domain.name,
    })),
  ];

  const creators = await listAllCreators({
    domainId: selectedDomain !== "all" ? selectedDomain : undefined,
    creatorType:
      selectedCreatorType !== "all" ? selectedCreatorType : undefined,
    q: searchQuery || undefined,
  });

  return (
    <Container className="py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
          Creators
        </h1>
        <p className="text-lg text-[var(--muted)]">
          Makers, leveranciers en workshopleiders op Hobbysalon
        </p>
      </header>

      <CardShell variant="default" padding="md" className="mb-6">
        <form method="get" className="grid gap-3 md:grid-cols-4">
          <Select
            id="domain"
            name="domain"
            label="Domein"
            options={domainOptions}
            defaultValue={selectedDomain}
          />
          <Select
            id="creator_type"
            name="creator_type"
            label="Type creator"
            options={CREATOR_TYPE_OPTIONS}
            defaultValue={selectedCreatorType}
          />
          <Input
            id="q"
            name="q"
            label="Zoekterm"
            defaultValue={searchQuery}
            placeholder="Naam, stad, expertise..."
          />
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90"
            >
              Filter
            </button>
            <Link
              href="/creators"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)]"
            >
              Reset
            </Link>
          </div>
        </form>
      </CardShell>

      {creators.length === 0 ? (
        <EmptyState
          title="Nog geen creators"
          description="Geen creators gevonden voor deze filters."
        />
      ) : (
        <>
          <p className="mb-6 text-sm text-[var(--muted)]">
            {creators.length} creator{creators.length !== 1 ? "s" : ""} gevonden
          </p>
          <GridLayout cols={3} gap="lg">
            {creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </GridLayout>
        </>
      )}
    </Container>
  );
}
