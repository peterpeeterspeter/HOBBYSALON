import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { CreatorProgressStep } from "@/lib/dashboard/creator-progress";

type CreatorDashboardHeaderProps = {
  creatorSlug: string | null;
  progressSteps: CreatorProgressStep[];
  /** Shorter intro for the personal profile hub */
  compact?: boolean;
};

export function CreatorDashboardHeader({
  creatorSlug,
  progressSteps,
  compact = false,
}: CreatorDashboardHeaderProps) {
  const completedCount = progressSteps.filter((step) => step.done).length;
  const allDone = completedCount === progressSteps.length && progressSteps.length > 0;

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="maker-pagina-heading"
            className={
              compact
                ? "text-2xl font-semibold text-[var(--foreground)]"
                : "text-3xl font-bold text-[var(--foreground)]"
            }
          >
            Jouw makerpagina
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            {allDone
              ? "Je publieke pagina staat klaar. Bewerk hier je naam, foto, hobby's, artikels of portfolio."
              : "Vul je naam, foto en hobby's in. Zo vinden bezoekers jou op Hobbysalon. Artikels en portfolio voeg je toe wanneer je klaar bent."}
          </p>
        </div>
        {creatorSlug && (
          <Link
            href={`/creator/${creatorSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-base font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Bekijk publieke pagina
          </Link>
        )}
      </div>

      {!allDone && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Voortgang ({completedCount}/{progressSteps.length})
          </p>
          <ul className="mt-3 space-y-2">
            {progressSteps.map((step) => (
              <li key={step.id} className="flex items-start gap-2 text-sm">
                {step.done ? (
                  <CheckCircle2
                    size={18}
                    className="mt-0.5 shrink-0 text-[var(--accent-secondary)]"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    size={18}
                    className="mt-0.5 shrink-0 text-[var(--muted)]"
                    aria-hidden="true"
                  />
                )}
                {step.href && !step.done ? (
                  <Link href={step.href} className="text-[var(--foreground)] underline">
                    {step.label}
                  </Link>
                ) : (
                  <span className={step.done ? "text-[var(--muted)]" : "text-[var(--foreground)]"}>
                    {step.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
