import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import {
  getLearningPathCompletionMap,
  listLearningPathsByDomain,
  listLearningPathStepsByPathIds,
} from "@/lib/platform/queries/learning-paths";
import { buildPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ domain: string }> };

function toPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  if (!domain) return { title: "Niet gevonden" };

  return buildPageMetadata({
    title: `Learning Paths ${domain.name} | Hobbysalon`,
    description:
      domain.short_description ??
      `Leertrajecten van beginner tot gevorderd in ${domain.name}.`,
    path: `/${domain.slug}/learning-paths`,
  });
}

export default async function DomainLearningPathsPage({ params }: Props) {
  const { domain: domainSlug } = await params;
  const domain = await getDomainBySlug(domainSlug);
  if (!domain) notFound();

  const user = await getAuthUser();
  const learningPaths = await listLearningPathsByDomain(domain.id);
  const steps = await listLearningPathStepsByPathIds(
    learningPaths.map((path) => path.id)
  );
  const completionMap = await getLearningPathCompletionMap(user?.id, steps);

  const stepsByPathId = new Map<string, typeof steps>();
  for (const step of steps) {
    const current = stepsByPathId.get(step.learning_path_id) ?? [];
    current.push(step);
    stepsByPathId.set(step.learning_path_id, current);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
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
          <li className="text-[var(--foreground)]">Learning paths</li>
        </ol>
      </nav>

      <header className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          Learning paths voor {domain.name}
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Kies een traject van beginner tot gevorderd met concrete stappen.
        </p>
      </header>

      <section className="mt-8">
        {learningPaths.length === 0 ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--muted)]">
            Nog geen learning paths voor dit domein.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {learningPaths.map((path) => {
              const pathSteps = stepsByPathId.get(path.id) ?? [];
              const completedCount = pathSteps.filter((step) =>
                completionMap.has(step.id)
              ).length;
              const percent = toPercent(completedCount, pathSteps.length);

              return (
                <article
                  key={path.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                    {path.difficulty_level}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                    {path.title}
                  </h2>
                  {path.short_description && (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {path.short_description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    {pathSteps.length} stap{pathSteps.length === 1 ? "" : "pen"} ·{" "}
                    {completedCount}/{pathSteps.length} voltooid
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-[var(--background)]">
                    <div
                      className="h-2 rounded-full bg-[var(--accent)]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <Link
                    href={`/${domain.slug}/learning-paths/${path.slug}`}
                    className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
                  >
                    Open traject →
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
