import Link from "next/link";
import type { Domain } from "@/types/platform";

type HomeHobbyChipsProps = {
  domains: Domain[];
};

export function HomeHobbyChips({ domains }: HomeHobbyChipsProps) {
  if (domains.length === 0) return null;

  return (
    <section className="mb-8" aria-label="Hobby's">
      <div className="flex flex-wrap gap-2">
        {domains.map((domain) => (
          <Link
            key={domain.id}
            href={`/${domain.slug}`}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)]"
          >
            {domain.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
