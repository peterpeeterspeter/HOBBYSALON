import Link from "next/link";
import { GridLayout } from "@/components/layout/grid-layout";
import { CreatorDiscoveryCard } from "@/components/creators/CreatorDiscoveryCard";
import type { CreatorDirectoryItem } from "@/lib/platform/queries/creators";

type HomeMakersProps = {
  makers: CreatorDirectoryItem[];
};

export function HomeMakers({ makers }: HomeMakersProps) {
  if (makers.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
            Ontmoet de mensen achter je hobby
          </h2>
          <p className="mt-2 text-[15px] text-[var(--muted)]">
            Makers die workshops geven, creaties maken of op markten staan.
          </p>
        </div>
        <Link
          href="/creators"
          className="inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
        >
          Alle makers
        </Link>
      </div>
      <GridLayout cols={3} gap="lg">
        {makers.map((creator) => (
          <CreatorDiscoveryCard key={creator.id} creator={creator} />
        ))}
      </GridLayout>
    </section>
  );
}
