import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Domain } from "@/types/platform";

type AgendaHobbyChipsProps = {
  domains: Domain[];
  activeDomainId?: string;
  hrefForDomain: (domainId?: string) => string;
  /** Max chips before “Meer hobby’s”. */
  visibleCount?: number;
};

/**
 * Readable domain chips (not letter circles) + optional “Meer hobby’s”.
 */
export function AgendaHobbyChips({
  domains,
  activeDomainId,
  hrefForDomain,
  visibleCount = 5,
}: AgendaHobbyChipsProps) {
  if (domains.length === 0) return null;

  const primary = domains.slice(0, visibleCount);
  const rest = domains.slice(visibleCount);

  return (
    <section className="mb-6" aria-label="Hobby's">
      <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
        Hobby&apos;s
      </h2>
      <div className="flex flex-wrap gap-2">
        {primary.map((domain) => {
          const active = activeDomainId === domain.id;
          return (
            <Link
              key={domain.id}
              href={hrefForDomain(active ? undefined : domain.id)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold transition-colors",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
              )}
              aria-current={active ? "true" : undefined}
            >
              {domain.name}
            </Link>
          );
        })}

        {rest.length > 0 ? (
          <details className="relative">
            <summary
              className={cn(
                "inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-semibold hover:border-[var(--accent)] [&::-webkit-details-marker]:hidden",
                rest.some((d) => d.id === activeDomainId)
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "text-[var(--foreground)]"
              )}
            >
              Meer hobby&apos;s
            </summary>
            <div className="absolute left-0 z-20 mt-2 flex max-h-72 w-[min(100vw-2rem,18rem)] flex-col gap-1 overflow-y-auto rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-md)]">
              {rest.map((domain) => {
                const active = activeDomainId === domain.id;
                return (
                  <Link
                    key={domain.id}
                    href={hrefForDomain(active ? undefined : domain.id)}
                    className={cn(
                      "min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold",
                      active
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "text-[var(--foreground)] hover:bg-[var(--section-highlight)]"
                    )}
                    aria-current={active ? "true" : undefined}
                  >
                    {domain.name}
                  </Link>
                );
              })}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
