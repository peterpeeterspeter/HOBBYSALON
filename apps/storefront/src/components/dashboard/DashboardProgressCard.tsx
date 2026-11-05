import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CreatorProgressStep } from "@/lib/dashboard/creator-progress";

/** Page setup as a checklist with a bar, so the remaining work is visible. */
export function DashboardProgressCard({ steps }: { steps: CreatorProgressStep[] }) {
  const done = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done) ?? null;
  if (!next) return null;
  const percent = Math.round((done / steps.length) * 100);
  return (
    <section aria-labelledby="voortgang-titel" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-[var(--accent-hover)]">Je pagina klaarmaken</p>
          <h2 id="voortgang-titel" className="mt-1 text-2xl font-bold text-[var(--foreground)]">
            Volgende stap: {next.label}
          </h2>
        </div>
        {next.href ? (
          <Button asChild size="lg">
            <Link href={next.href}>Verder</Link>
          </Button>
        ) : null}
      </div>
      <div className="mt-6 flex items-center gap-4">
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--section-alt)]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${done} van ${steps.length} stappen klaar`}
        >
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(percent, 4)}%` }} />
        </div>
        <span className="text-base font-semibold tabular-nums text-[var(--foreground)]">
          {done} van {steps.length}
        </span>
      </div>
      <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 text-lg">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                step.done ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)]"
              }`}
              aria-hidden
            >
              {step.done ? <Check size={16} /> : null}
            </span>
            {step.href && !step.done ? (
              <Link href={step.href} className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline">
                {step.label}
              </Link>
            ) : (
              <span className={step.done ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}>{step.label}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
