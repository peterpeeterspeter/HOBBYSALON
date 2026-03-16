import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { AddBundleToCartButton } from "@/components/cart/AddBundleToCartButton";
import { ProductCard, WorkshopCard, EventCard, ArticleCard, CreatorCard } from "@/components/cards";
import { PageLayout } from "@/components/layout/page-layout";
import { GridLayout } from "@/components/layout/grid-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Badge } from "@/components/ui/badge";
import { getProjectPageData } from "@/lib/services/project-page";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import { getAuthUser } from "@/lib/auth/session";

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
  const [data, viewer] = await Promise.all([getProjectPageData(slug), getAuthUser()]);

  if (!data.project) notFound();

  const { project, domains, steps, galleryImages, bundleItems, soughtMaterials, relatedProducts, relatedWorkshops, relatedEvents, relatedArticles, relatedCreators } =
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

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: project.title },
  ];

  return (
    <PageLayout breadcrumbs={breadcrumbs} title={project.title} description={project.short_description ?? undefined}>
      <JsonLd data={howToJsonLd} />
      <TrackOnMount
        event="project_view"
        payload={{
          project_id: project.id,
          project_slug: project.slug,
          difficulty_level: project.difficulty_level,
          user_id: viewer?.id ?? null,
        }}
      />

      <CardShell variant="default" padding="lg" className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Project
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
          <Badge variant="difficulty" difficulty={project.difficulty_level as "beginner" | "intermediate" | "advanced"}>
            {DIFFICULTY_LABELS[project.difficulty_level] ?? project.difficulty_level}
          </Badge>
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
              <Link key={domain.id} href={`/${domain.slug}`}>
                <Badge variant="domain" className="cursor-pointer hover:opacity-90">
                  {domain.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardShell>

      {(bundleItems.length > 0 || soughtMaterials.length > 0) && (
        <section className="mt-8 space-y-6">
          {bundleItems.length > 0 && (
            <div>
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
            </div>
          )}
          {soughtMaterials.length > 0 && (
            <div>
              <h2 className="mb-3 text-xl font-semibold text-[var(--foreground)]">
                Materialen gezocht
              </h2>
              <p className="mb-3 text-sm text-[var(--muted)]">
                Dit project gebruikt onderstaande materialen die niet (meer) in de webshop staan.
              </p>
              <ul className="space-y-2">
                {soughtMaterials.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-[var(--foreground)]">{m.title}</span>
                    {m.notes && (
                      <span className="ml-2 text-[var(--muted)]">– {m.notes}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {steps.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Stappenplan</h2>
          <ol className="space-y-3">
            {steps.map((step) => (
              <li key={step.id} id={`step-${step.step_order}`}>
                <CardShell variant="default" padding="md">
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
                  Stap {step.step_order}
                </p>
                <h3 className="mt-1 font-semibold text-[var(--foreground)]">{step.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-[var(--foreground)]">{step.instruction}</p>
                </CardShell>
              </li>
            ))}
          </ol>
        </section>
      )}

      {galleryImages.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">
            Afgewerkte creaties
          </h2>
          <GridLayout cols={3}>
            {galleryImages.map((image) => (
              <CardShell key={image.id} variant="default" padding="sm">
                <div className="aspect-square overflow-hidden rounded-md bg-[var(--border)]">
                  <img
                    src={image.image_url}
                    alt={image.alt_text ?? project.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                {image.alt_text && (
                  <p className="mt-2 text-sm text-[var(--muted)]">{image.alt_text}</p>
                )}
              </CardShell>
            ))}
          </GridLayout>
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Benodigde producten</h2>
          <GridLayout cols={4}>
            {relatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </GridLayout>
        </section>
      )}

      {relatedWorkshops.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Relevante workshops</h2>
          <GridLayout cols={3}>
            {relatedWorkshops.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </GridLayout>
        </section>
      )}

      {relatedEvents.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Gerelateerde events</h2>
          <GridLayout cols={3}>
            {relatedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </GridLayout>
        </section>
      )}

      {relatedArticles.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Inspiratie & artikelen</h2>
          <GridLayout cols={3}>
            {relatedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </GridLayout>
        </section>
      )}

      {relatedCreators.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Betrokken makers</h2>
          <GridLayout cols={3}>
            {relatedCreators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </GridLayout>
        </section>
      )}
    </PageLayout>
  );
}
