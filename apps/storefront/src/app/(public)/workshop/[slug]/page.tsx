import { notFound } from "next/navigation";
import { getWorkshopPageData } from "@/lib/services/workshop-page";
import { CreatorCard, ProductCard, EventCard, ArticleCard } from "@/components/cards";
import { EntityLinkBlock } from "@/components/shared/EntityLinkBlock";
import { WorkshopBookingRequestForm } from "@/components/workshop/WorkshopBookingRequestForm";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { PageLayout } from "@/components/layout/page-layout";
import { SplitLayout } from "@/components/layout/split-layout";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { PriceDisplay } from "@/components/domain/price-display";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

const FORMAT_LABELS: Record<string, string> = {
  physical: "Fysiek",
  online: "Online",
  hybrid: "Hybride",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Gevorderd",
  advanced: "Expert",
};

function formatSessionDate(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { workshop } = await getWorkshopPageData(slug);
  if (!workshop) return { title: "Niet gevonden" };
  return buildPageMetadata({
    title: workshop.seo_title ?? `${workshop.title} | Hobbysalon`,
    description: workshop.seo_description ?? workshop.short_description ?? undefined,
    path: `/workshop/${workshop.slug}`,
    image: workshop.featured_image_url,
  });
}

export default async function WorkshopPage({ params }: Props) {
  const { slug } = await params;
  const data = await getWorkshopPageData(slug);

  if (!data.workshop) notFound();

  const { workshop, creator, domain, sessions, requiredProducts, optionalProducts } = data;
  const user = await getAuthUser();
  const workshopIsFavorite = user
    ? await isFavorite(user.id, "workshop", workshop.id)
    : false;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    ...(domain ? [{ label: domain.name, href: `/${domain.slug}` } as const] : []),
    { label: workshop.title },
  ];

  return (
    <PageLayout
      breadcrumbs={breadcrumbs}
      title={workshop.title}
      description={workshop.short_description ?? undefined}
    >
      <SplitLayout
        sidebar={
          <div className="space-y-4">
            <AspectImage
              src={workshop.featured_image_url}
              alt={workshop.title}
              ratio="video"
            />
            <FavoriteToggleButton
              entityType="workshop"
              entityId={workshop.id}
              isFavorited={workshopIsFavorite}
              nextPath={`/workshop/${workshop.slug}`}
            />
          </div>
        }
      >
        <CardShell variant="default" padding="lg">
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
            {FORMAT_LABELS[workshop.format_type] ?? workshop.format_type} ·{" "}
            {DIFFICULTY_LABELS[workshop.difficulty_level] ?? workshop.difficulty_level}
          </span>
          {workshop.price_cents > 0 && (
            <div className="mt-4">
              <PriceDisplay
                amount={workshop.price_cents}
                currencyCode={workshop.currency_code}
                size="lg"
              />
            </div>
          )}
          {workshop.duration_minutes && (
            <p className="mt-2 text-[var(--muted)]">
              Duur: ±{workshop.duration_minutes} minuten
            </p>
          )}
          {workshop.location_name && (
            <p className="mt-2 text-[var(--muted)]">
              Locatie: {workshop.location_name}
              {workshop.city && `, ${workshop.city}`}
            </p>
          )}
          {workshop.description && (
            <p className="mt-4 whitespace-pre-wrap text-[var(--foreground)]">
              {workshop.description}
            </p>
          )}
          {workshop.booking_mode === "external_link" && workshop.booking_url && (
            <a
              href={workshop.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] hover:opacity-90"
            >
              Boek nu
            </a>
          )}
          {workshop.booking_mode === "request" && creator && (
            <WorkshopBookingRequestForm
              workshopId={workshop.id}
              creatorId={workshop.creator_id}
              sessions={sessions}
            />
          )}
        </CardShell>
      </SplitLayout>

      {sessions.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Data
          </h2>
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id}>
                <CardShell variant="default" padding="md">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">
                        {formatSessionDate(s.starts_at)} – {formatSessionDate(s.ends_at)}
                      </p>
                      {s.capacity != null && (
                        <p className="text-sm text-[var(--muted)]">
                          {s.remaining_spots != null
                            ? `${s.remaining_spots} plekken over`
                            : `${s.capacity} plekken`}
                        </p>
                      )}
                    </div>
                    <span
                      className={
                        s.booking_status === "open"
                          ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "rounded-full bg-[var(--border)] px-3 py-1 text-sm text-[var(--muted)]"
                      }
                    >
                      {s.booking_status === "open" ? "Beschikbaar" : s.booking_status}
                    </span>
                  </div>
                </CardShell>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creator && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Workshopleider
          </h2>
          <CreatorCard creator={creator} className="max-w-md" />
        </section>
      )}

      <EntityLinkBlock
        title="Benodigde materialen"
        isEmpty={requiredProducts.length === 0}
        emptyMessage="Geen verplichte materialen opgegeven."
      >
        {requiredProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </EntityLinkBlock>

      <EntityLinkBlock
        title="Aanbevolen materialen"
        isEmpty={optionalProducts.length === 0}
        emptyMessage="Geen extra materialen."
      >
        {optionalProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </EntityLinkBlock>

      <EntityLinkBlock
        title="Gerelateerde evenementen"
        isEmpty={data.relatedEvents.length === 0}
        emptyMessage="Geen gerelateerde evenementen."
      >
        {data.relatedEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </EntityLinkBlock>

      <EntityLinkBlock
        title="Gerelateerde artikelen"
        isEmpty={data.relatedArticles.length === 0}
        emptyMessage="Geen gerelateerde artikelen."
      >
        {data.relatedArticles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </EntityLinkBlock>
    </PageLayout>
  );
}
