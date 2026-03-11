import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { AddBundleToCartButton } from "@/components/cart/AddBundleToCartButton";
import { ProductCard } from "@/components/shared/ProductCard";
import { WorkshopCard } from "@/components/shared/WorkshopCard";
import { EventCard } from "@/components/shared/EventCard";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { CreatorCard } from "@/components/shared/CreatorCard";
import { getProjectPageData } from "@/lib/services/project-page";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Gevorderd",
  advanced: "Expert",
};

function formatDuration(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} u`;
  return `${hours} u ${mins} min`;
}

function formatBudget(cents: number | null, currencyCode: string): string | null {
  if (cents == null || cents <= 0) return null;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { project } = await getProjectPageData(slug);

  if (!project) return { title: "Niet gevonden" };

  return buildPageMetadata({
    title: project.seo_title ?? `${project.title} | Hobbysalon Project`,
    description:
      project.seo_description ??
      project.short_description ??
      "Ontdek dit hobbyproject met stappen, materialen en workshops.",
    path: `/project/${project.slug}`,
    image: project.featured_image_url,
    type: "article",
  });
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProjectPageData(slug);

  if (!data.project) notFound();

  const { project, domains, steps, bundleItems, relatedProducts, relatedWorkshops, relatedEvents, relatedArticles, relatedCreators } =
    data;
  const durationLabel = formatDuration(project.estimated_duration_minutes);
  const budgetMinLabel = formatBudget(project.budget_min_cents, project.currency_code);
  const budgetMaxLabel = formatBudget(project.budget_max_cents, project.currency_code);
  const bundleTotalCents = bundleItems.reduce(
    (sum, item) => sum + (item.price_amount ?? 0),
    0
  );
  const bundleCurrencyCode = bundleItems.find((item) => item.currency_code)?.currency_code ?? "EUR";

  const howToJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: project.title,
    description: project.short_description ?? project.description ?? undefined,
    image: project.featured_image_url ? [absoluteUrl(project.featured_image_url)] : undefined,
    totalTime:
      project.estimated_duration_minutes != null
        ? `PT${Math.max(project.estimated_duration_minutes, 0)}M`
        : undefined,
    step: steps.map((step) => ({
      "@type": "HowToStep",
      name: step.title,
      text: step.instruction,
      url: absoluteUrl(`/project/${project.slug}#step-${step.step_order}`),
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={howToJsonLd} />
      <TrackOnMount
        event="project_view"
        payload={{
          project_id: project.id,
          project_slug: project.slug,
          difficulty_level: project.difficulty_level,
        }}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li>/</li>
          <li className="text-[var(--foreground)]">{project.title}</li>
        </ol>
      </nav>

      <header className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Project
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">{project.title}</h1>
        {project.short_description && (
          <p className="mt-3 max-w-3xl text-[var(--foreground)]">{project.short_description}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
          <span className="rounded-full border border-[var(--border)] px-3 py-1">
            Niveau: {DIFFICULTY_LABELS[project.difficulty_level] ?? project.difficulty_level}
          </span>
          {durationLabel && (
            <span className="rounded-full border border-[var(--border)] px-3 py-1">
              Duur: {durationLabel}
            </span>
          )}
          {(budgetMinLabel || budgetMaxLabel) && (
            <span className="rounded-full border border-[var(--border)] px-3 py-1">
              Budget: {budgetMinLabel ?? "?"} - {budgetMaxLabel ?? "?"}
            </span>
          )}
        </div>
        {domains.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {domains.map((domain) => (
              <Link
                key={domain.id}
                href={`/${domain.slug}`}
                className="rounded-full bg-[var(--background)] px-3 py-1 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
              >
                {domain.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      {bundleItems.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold text-[var(--foreground)]">
            Startbundel materialen
          </h2>
          {bundleTotalCents > 0 && (
            <p className="mb-3 text-sm text-[var(--muted)]">
              Indicatief totaal: {formatPrice(bundleTotalCents, bundleCurrencyCode)}
            </p>
          )}
          <AddBundleToCartButton
            bundleId={`project:${project.id}`}
            bundleLabel={project.title}
            items={bundleItems}
          />
        </section>
      )}

      {steps.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Stappenplan</h2>
          <ol className="space-y-3">
            {steps.map((step) => (
              <li
                key={step.id}
                id={`step-${step.step_order}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
                  Stap {step.step_order}
                </p>
                <h3 className="mt-1 font-semibold text-[var(--foreground)]">{step.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-[var(--foreground)]">{step.instruction}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Benodigde producten</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {relatedWorkshops.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Relevante workshops</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedWorkshops.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </div>
        </section>
      )}

      {relatedEvents.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Gerelateerde events</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {relatedArticles.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Inspiratie & artikelen</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}

      {relatedCreators.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Betrokken makers</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedCreators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
