import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventPageData } from "@/lib/services/event-page";
import { CreatorCard } from "@/components/shared/CreatorCard";
import { ProductCard } from "@/components/shared/ProductCard";
import { WorkshopCard } from "@/components/shared/WorkshopCard";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { JsonLd } from "@/components/seo/JsonLd";
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

function formatPrice(cents: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: (currencyCode ?? "EUR").toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={eventJsonLd} />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/agenda" className="hover:text-[var(--foreground)]">
              Agenda
            </Link>
          </li>
          <li>/</li>
          <li className="text-[var(--foreground)]">{event.title}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-video overflow-hidden rounded-lg bg-[var(--border)] lg:aspect-[4/3]">
          {event.featured_image_url ? (
            <img
              src={event.featured_image_url}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
              Geen afbeelding
            </div>
          )}
        </div>
        <div>
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
            {typeLabel}
            {event.city && ` · ${event.city}`}
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
            {event.title}
          </h1>
          <p className="mt-4 text-lg text-[var(--foreground)]">
            {formatDate(event.starts_at)} – {formatDate(event.ends_at)}
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
          {event.ticket_price_cents != null &&
            event.ticket_price_cents > 0 && (
              <p className="mt-2 font-semibold text-[var(--foreground)]">
                Ticket: {formatPrice(event.ticket_price_cents, event.currency_code ?? "EUR")}
              </p>
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
          {event.short_description && (
            <p className="mt-4 text-[var(--foreground)]">{event.short_description}</p>
          )}
          <div className="mt-4">
            <FavoriteToggleButton
              entityType="event"
              entityId={event.id}
              isFavorited={eventIsFavorite}
              nextPath={`/agenda/${event.slug}`}
            />
          </div>
          {event.description && (
            <p className="mt-4 whitespace-pre-wrap text-[var(--foreground)]">
              {event.description}
            </p>
          )}
        </div>
      </div>

      {domains.length > 0 && (
        <section className="mt-12">
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
        </section>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        </section>
      )}

      {workshops.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Workshops op dit evenement
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workshops.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </div>
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Uitgelichte producten
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {relatedArticles.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Gerelateerde artikelen
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
