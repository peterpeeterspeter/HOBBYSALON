import Link from "next/link";
import type { CreatorProgressStep } from "@/lib/dashboard/creator-progress";
import {
  getCreatorProgressPercent,
  getNextProgressStep,
} from "@/lib/dashboard/creator-progress";
import { Button } from "@/components/ui/button";

type CreatorDashboardHeaderProps = {
  creatorSlug: string | null;
  progressSteps: CreatorProgressStep[];
  /** Shorter intro for the personal profile hub */
  compact?: boolean;
  title?: string;
  lead?: string;
};

export function CreatorDashboardHeader({
  creatorSlug,
  progressSteps,
  compact = false,
  title = "Jouw makerprofiel",
  lead = "Toon wie je bent en wat je maakt.",
}: CreatorDashboardHeaderProps) {
  const percent = getCreatorProgressPercent(progressSteps);
  const nextStep = getNextProgressStep(progressSteps);
  const allDone = !nextStep && progressSteps.length > 0;

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
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            {allDone
              ? "Je publieke pagina staat klaar. Bewerk hier je gegevens wanneer je wilt."
              : lead}
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

      {!allDone && nextStep ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Je profiel is voor {percent}% klaar
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">Volgende stap: {nextStep.label}</p>
          {nextStep.href ? (
            <div className="mt-4">
              <Button asChild>
                <Link href={nextStep.href}>Ga verder</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
