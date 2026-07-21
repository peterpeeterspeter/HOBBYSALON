import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { CreatorProgressStep } from "@/lib/dashboard/creator-progress";

type CreatorDashboardHeaderProps = {
  creatorSlug: string | null;
  progressSteps: CreatorProgressStep[];
};

export function CreatorDashboardHeader({
  creatorSlug,
  progressSteps,
}: CreatorDashboardHeaderProps) {
  const completedCount = progressSteps.filter((step) => step.done).length;

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Mijn pagina</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Vul je maker-pagina in, schrijf artikels en toon je afgewerkte creaties.
            Rollen en voorkeuren regel je onder Account.
          </p>
        </div>
        {creatorSlug && (
          <Link
            href={`/creator/${creatorSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
          >
            Bekijk je publieke pagina
          </Link>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm font-medium text-[var(--foreground)]">
          Voortgang ({completedCount}/{progressSteps.length})
        </p>
        <ul className="mt-3 space-y-2">
          {progressSteps.map((step) => (
            <li key={step.id} className="flex items-start gap-2 text-sm">
              {step.done ? (
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-green-600"
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
    </header>
  );
}
