import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventPageData } from "@/lib/services/event-page";
import { CreatorCard, ProductCard, WorkshopCard, ArticleCard } from "@/components/cards";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageLayout } from "@/components/layout/page-layout";
import { SplitLayout } from "@/components/layout/split-layout";
import { GridLayout } from "@/components/layout/grid-layout";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { PriceDisplay } from "@/components/domain/price-display";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

const EVENT_TYPE_LABELS: Record<string, string> = {
  handmade_market: "Handmade markt",
  hobby_fair: "Hobbybeurs",
  pop_up: "Pop-up",
  open_atelier: "Open atelier",
  workshop_day: "Workshopdag",
};

function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { event } = await getEventPageData(slug);
  if (!event) return { title: "Niet gevonden" };
  return buildPageMetadata({
    title: event.seo_title ?? `${event.title} | Hobbysalon Agenda`,
    description: event.seo_description ?? event.short_description ?? undefined,
    path: `/agenda/${event.slug}`,
    image: event.featured_image_url,
    type: "website",
  });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const data = await getEventPageData(slug);

  if (!data.event) notFound();

  const {
    event,
    organizer,
    domains,
    creators,
    workshops,
    relatedProducts,
    relatedArticles,
  } =
    data;
  const user = await getAuthUser();
  const eventIsFavorite = user ? await isFavorite(user.id, "event", event.id) : false;
  const typeLabel = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;
  const eventJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.short_description ?? event.description ?? undefined,
    startDate: event.starts_at,
    endDate: event.ends_at,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: event.featured_image_url
      ? [absoluteUrl(event.featured_image_url)]
      : undefined,
    location: {
      "@type": "Place",
      name: event.location_name ?? event.title,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.address_line_1 ?? undefined,
        postalCode: event.postal_code ?? undefined,
        addressLocality: event.city ?? undefined,
        addressCountry: event.country_code ?? "BE",
      },
    },
    organizer: organizer
      ? {
          "@type": "Organization",
          name: organizer.display_name,
          url: absoluteUrl(`/creator/${organizer.slug}`),
        }
      : undefined,
    offers:
      event.ticket_price_cents != null && event.ticket_price_cents > 0
        ? {
            "@type": "Offer",
            price: (event.ticket_price_cents / 100).toFixed(2),
            priceCurrency: (event.currency_code ?? "EUR").toUpperCase(),
            availability: "https://schema.org/InStock",
            url: event.ticket_url ?? absoluteUrl(`/agenda/${event.slug}`),
          }
        : undefined,
  };

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Agenda", href: "/agenda" },
    { label: event.title },
  ];

  return (
    <PageLayout
      breadcrumbs={breadcrumbs}
      title={event.title}
      description={event.short_description ?? undefined}
    >
      <JsonLd data={eventJsonLd} />
      <SplitLayout
        sidebar={
          <div className="space-y-4">
            <AspectImage src={event.featured_image_url} alt={event.title} ratio="video" />
            <FavoriteToggleButton
              entityType="event"
              entityId={event.id}
              isFavorited={eventIsFavorite}
              nextPath={`/agenda/${event.slug}`}
            />
          </div>
        }
      >
        <CardShell variant="default" padding="lg">
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
            {typeLabel}
            {event.city && ` · ${event.city}`}
          </span>
          <p className="mt-4 text-lg text-[var(--foreground)]">
            {formatEventDate(event.starts_at)} – {formatEventDate(event.ends_at)}
          </p>
          {event.location_name && (
            <p className="mt-2 text-[var(--muted)]">
              Locatie: {event.location_name}
            </p>
          )}
          {event.address_line_1 && (
            <p className="text-[var(--muted)]">
              {event.address_line_1}
              {event.postal_code && event.city && (
                <>, {event.postal_code} {event.city}</>
              )}
            </p>
          )}
          {event.ticket_price_cents != null && event.ticket_price_cents > 0 && (
            <div className="mt-2 font-semibold text-[var(--foreground)]">
              Ticket:{" "}
              <PriceDisplay
                amount={event.ticket_price_cents}
                currencyCode={event.currency_code ?? "EUR"}
                size="md"
              />
            </div>
          )}
          {event.ticketing_mode === "external_link" && event.ticket_url && (
            <a
              href={event.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] hover:opacity-90"
            >
              Koop tickets
            </a>
          )}
          {event.description && (
            <p className="mt-4 whitespace-pre-wrap text-[var(--foreground)]">
              {event.description}
            </p>
          )}
        </CardShell>
      </SplitLayout>

      {domains.length > 0 && (
        <CardShell variant="default" padding="md" className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Domeinen
          </h2>
          <div className="flex flex-wrap gap-2">
            {domains.map((d) => (
              <Link
                key={d.id}
                href={`/${d.slug}`}
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)]"
              >
                {d.name}
              </Link>
            ))}
          </div>
        </CardShell>
      )}

      {organizer && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Organisator
          </h2>
          <CreatorCard creator={organizer} className="max-w-md" />
        </section>
      )}

      {creators.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Deelnemende makers
          </h2>
          <GridLayout cols={3}>
            {creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </GridLayout>
        </section>
      )}

      {workshops.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Workshops op dit evenement
          </h2>
          <GridLayout cols={3}>
            {workshops.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </GridLayout>
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Uitgelichte producten
          </h2>
          <GridLayout cols={3}>
            {relatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </GridLayout>
        </section>
      )}

      {relatedArticles.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Gerelateerde artikelen
          </h2>
          <GridLayout cols={3}>
            {relatedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </GridLayout>
        </section>
      )}
    </PageLayout>
  );
}
