import { listAllCreators } from "@/lib/platform/queries/creators";
import { CreatorCard } from "@/components/shared/CreatorCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creators | Hobbysalon",
  description: "Ontdek makers, leveranciers en workshopleiders",
};

export default async function CreatorsPage() {
  const creators = await listAllCreators();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
          Creators
        </h1>
        <p className="text-lg text-[var(--muted)]">
          Makers, leveranciers en workshopleiders op Hobbysalon
        </p>
      </header>

      {creators.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-12 text-center text-[var(--muted)]">
          Nog geen creators toegevoegd.
        </p>
      ) : (
        <>
          <p className="mb-6 text-sm text-[var(--muted)]">
            {creators.length} creator{creators.length !== 1 ? "s" : ""} gevonden
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
