import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import {
  getLearningPathByDomainAndSlug,
  getLearningPathCompletionMap,
  listLearningPathSteps,
  resolveLearningPathStepTargets,
} from "@/lib/platform/queries/learning-paths";
import { buildPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ domain: string; pathSlug: string }> };

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function getStepTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    article: "Artikel",
    workshop: "Workshop",
    product: "Product",
    project: "Project",
  };
  return labels[type] ?? type;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain: domainSlug, pathSlug } = await params;
  const domain = await getDomainBySlug(domainSlug);
  if (!domain) return { title: "Niet gevonden" };

  const path = await getLearningPathByDomainAndSlug(domain.id, pathSlug);
  if (!path) return { title: "Niet gevonden" };

  return buildPageMetadata({
    title: `${path.title} | ${domain.name} Learning Path`,
    description:
      path.short_description ??
      `Stapsgewijs traject voor ${domain.name}.`,
    path: `/${domain.slug}/learning-paths/${path.slug}`,
  });
}

export default async function LearningPathDetailPage({ params }: Props) {
  const { domain: domainSlug, pathSlug } = await params;
  const domain = await getDomainBySlug(domainSlug);
  if (!domain) notFound();

  const path = await getLearningPathByDomainAndSlug(domain.id, pathSlug);
  if (!path) notFound();

  const user = await getAuthUser();
  const steps = await listLearningPathSteps(path.id);
  const [targetsByStepId, completionMap] = await Promise.all([
    resolveLearningPathStepTargets(steps),
    getLearningPathCompletionMap(user?.id, steps),
  ]);

  const completedCount = steps.filter((step) => completionMap.has(step.id)).length;
  const percent =
    steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/${domain.slug}`} className="hover:text-[var(--foreground)]">
              {domain.name}
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link
              href={`/${domain.slug}/learning-paths`}
              className="hover:text-[var(--foreground)]"
            >
              Learning paths
            </Link>
          </li>
          <li>/</li>
          <li className="text-[var(--foreground)]">{path.title}</li>
        </ol>
      </nav>

      <header className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          {path.difficulty_level}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">{path.title}</h1>
        {path.short_description && (
          <p className="mt-3 text-[var(--muted)]">{path.short_description}</p>
        )}
        <p className="mt-4 text-sm text-[var(--muted)]">
          {completedCount}/{steps.length} stappen voltooid
        </p>
        <div className="mt-2 h-2 rounded-full bg-[var(--background)]">
          <div
            className="h-2 rounded-full bg-[var(--accent)]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      <section className="mt-8">
        {steps.length === 0 ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--muted)]">
            Nog geen stappen geconfigureerd.
          </p>
        ) : (
          <ol className="space-y-3">
            {steps.map((step) => {
              const target = targetsByStepId.get(step.id) ?? null;
              const completedAt = completionMap.get(step.id) ?? null;
              const completed = !!completedAt;
              return (
                <li
                  key={step.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
                      Stap {step.step_order}
                    </p>
                    <span
                      className={
                        completed
                          ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800"
                          : "rounded-full bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]"
                      }
                    >
                      {completed ? "Voltooid" : "Nog te doen"}
                    </span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                    {step.title}
                  </h2>
                  {step.instruction && (
                    <p className="mt-2 text-[var(--foreground)]">{step.instruction}</p>
                  )}
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Type: {getStepTypeLabel(step.related_entity_type)}
                    {step.estimated_minutes
                      ? ` · ${step.estimated_minutes} min`
                      : ""}
                  </p>
                  {target ? (
                    <Link
                      href={target.href}
                      className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
                    >
                      Open {target.title} →
                    </Link>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      Gerelateerde inhoud niet beschikbaar.
                    </p>
                  )}
                  {completedAt && (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Voltooid op {formatDateTime(completedAt)}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
