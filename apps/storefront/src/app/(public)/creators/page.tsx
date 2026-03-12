import { listAllCreators } from "@/lib/platform/queries/creators";
import { CreatorCard } from "@/components/cards";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creators | Hobbysalon",
  description: "Ontdek makers, leveranciers en workshopleiders",
};

export default async function CreatorsPage() {
  const creators = await listAllCreators();

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

      {creators.length === 0 ? (
        <EmptyState
          title="Nog geen creators"
          description="Nog geen creators toegevoegd."
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
