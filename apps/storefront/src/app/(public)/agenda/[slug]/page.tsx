import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, Clock, MapPin, Tag } from "lucide-react";
import { getEventPageData } from "@/lib/services/event-page";
import { canUseExternalTicketLink } from "@/lib/platform/commercial-entitlements";
import {
  WorkshopCard,
} from "@/components/cards";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { EventTicketCard } from "@/components/events/EventTicketCard";
import { EventStandhouderRsvpCard } from "@/components/events/EventStandhouderRsvpCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { GridLayout } from "@/components/layout/grid-layout";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { getStandhouderRsvpState } from "@/app/actions/event-standhouder-rsvp";
import { isEligibleStandhouder } from "@/lib/platform/event-standhouder";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import type { Creator, Product } from "@/types/platform";

type Props = { params: Promise<{ slug: string }> };

const EVENT_TYPE_LABELS: Record<string, string> = {
  handmade_market: "Handmade markt",
  hobby_fair: "Hobbybeurs",
  pop_up: "Pop-up",
  open_atelier: "Open atelier",
  workshop_day: "Workshopdag",
};

const CREATOR_TYPE_LABELS: Record<string, string> = {
  maker: "Maker",
  workshopgever: "Workshopgever",
  supplier: "Leverancier",
  content_creator: "Content maker",
  organizer: "Organisator",
};

const ROLE_LABELS: Record<string, string> = {
  vendor: "Standhouder",
  workshop_host: "Workshopgever",
  speaker: "Spreker",
  organizer: "Organisator",
};

function creatorCategoryLabel(creator: Creator, role?: string | null): string {
  if (role && ROLE_LABELS[role]) return ROLE_LABELS[role];
  const types = (creator.creator_types ?? [])
    .map((type) => CREATOR_TYPE_LABELS[type] ?? type)
    .filter(Boolean);
  return types.length > 0 ? types.join(" · ") : "Maker";
}

function productImageUrl(product: Product): string | null {
  return product.featured_image_url?.trim() || null;
}

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dayMonthFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });

function formatDateParts(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const sameYear = start.getFullYear() === end.getFullYear();

  const dateLabel = sameDay
    ? dateFmt.format(start)
    : `${sameYear ? dayMonthFmt.format(start) : dateFmt.format(start)} – ${dateFmt.format(end)}`;

  return {
    dateLabel,
    timeLabel: `${timeFmt.format(start)} – ${timeFmt.format(end)}`,
    isMultiDay: !sameDay,
  };
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
    exhibitors,
    workshops,
    galleryImages,
    relatedProducts,
    relatedArticles,
    relatedEvents,
    eventEntitlements,
  } = data;

  const allowExternalTickets = eventEntitlements
    ? canUseExternalTicketLink(eventEntitlements)
    : true;

  const user = await getAuthUser();
  const [eventIsFavorite, creator, registrationContext] = await Promise.all([
    user ? isFavorite(user.id, "event", event.id) : Promise.resolve(false),
    user ? getCreatorByUserId(user.id) : Promise.resolve(null),
    user ? getUserRegistrationContext(user.id) : Promise.resolve(null),
  ]);
  const isEligible = creator
    ? isEligibleStandhouder({
        creatorTypes: creator.creator_types,
        roles: registrationContext?.roles ?? [],
      })
    : false;
  const hasRsvped =
    creator != null
      ? await getStandhouderRsvpState({
          eventId: event.id,
          creatorId: creator.id,
        })
      : false;

  const typeLabel = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;
  const { dateLabel, timeLabel, isMultiDay } = formatDateParts(
    event.starts_at,
    event.ends_at
  );
  const locationLabel = event.location_name ?? event.city ?? null;
  const isFree = event.ticket_price_cents == null || event.ticket_price_cents <= 0;
  const priceLabel = isFree
    ? "Gratis toegang"
    : `€${((event.ticket_price_cents as number) / 100).toFixed(2)}`;

  const eventJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.short_description ?? event.description ?? undefined,
    startDate: event.starts_at,
    endDate: event.ends_at,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: event.featured_image_url ? [absoluteUrl(event.featured_image_url)] : undefined,
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
            url: allowExternalTickets && event.ticket_url
              ? event.ticket_url
              : absoluteUrl(`/agenda/${event.slug}`),
          }
        : undefined,
  };

  const infoCells = [
    { icon: Calendar, label: "Datum", value: dateLabel },
    {
      icon: Clock,
      label: "Tijd",
      value: isMultiDay ? "Meerdaags evenement" : timeLabel,
    },
    locationLabel
      ? { icon: MapPin, label: "Locatie", value: locationLabel }
      : null,
    { icon: Tag, label: "Type", value: typeLabel },
  ].filter((c): c is { icon: typeof Calendar; label: string; value: string } => c !== null);

  const allCreators = [
    ...(organizer ? [organizer] : []),
    ...creators.filter((c) => c.id !== organizer?.id),
  ];
  const roleByCreatorId = new Map(
    exhibitors.map((exhibitor) => [exhibitor.creator.id, exhibitor.role])
  );
  const masonryProducts = (
    exhibitors.some((exhibitor) => exhibitor.products.length > 0)
      ? exhibitors.flatMap((exhibitor) => exhibitor.products)
      : relatedProducts
  ).filter((product) => productImageUrl(product));

  return (
    <>
      <JsonLd data={eventJsonLd} />

      {/* Hero */}
      <div className="relative h-[400px] overflow-hidden sm:h-[480px] lg:h-[540px]">
        {event.featured_image_url ? (
          <img
            src={event.featured_image_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--color-amber-500)] to-[var(--color-amber-700)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/92 via-[var(--foreground)]/50 to-[var(--foreground)]/20" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-8 sm:pb-10">
            <p className="mb-2 text-sm font-semibold text-white/80">
              {typeLabel}
              {domains.length > 0 && ` · ${domains.map((d) => d.name).join(" · ")}`}
            </p>
            <h1 className="max-w-3xl font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight tracking-[-0.03em] text-white sm:text-4xl lg:text-[2.75rem]">
              {event.title}
            </h1>
            <div className="mt-4 space-y-1.5">
              <p className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--accent-light)] sm:text-2xl">
                {dateLabel}
              </p>
              {locationLabel ? (
                <p className="text-base font-semibold text-white/90 sm:text-lg">
                  {locationLabel}
                </p>
              ) : null}
              <p className="text-sm font-medium text-white/75">
                {isMultiDay ? "Meerdaags evenement" : timeLabel}
                {" · "}
                {priceLabel}
                {workshops.length > 0
                  ? ` · ${workshops.length} workshop${workshops.length === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {galleryImages.length > 0 ? (
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {galleryImages.map((image) => (
              <li key={image.id}>
                <img
                  src={image.image_url}
                  alt={image.alt_text ?? event.title}
                  className="aspect-square w-full rounded-[0.75rem] object-cover"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Main layout */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Left column */}
        <div className="min-w-0">
          {/* Info band */}
          <div className="mb-8 grid grid-cols-2 gap-4 rounded-[1.25rem] bg-[var(--section-alt)] p-5 sm:grid-cols-4 sm:gap-5 sm:px-6 sm:py-6">
            {infoCells.map((cell) => (
              <div key={cell.label} className="flex items-start gap-2.5">
                <cell.icon
                  size={18}
                  className="mt-0.5 shrink-0 text-[var(--accent)]"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--muted)]">
                    {cell.label}
                  </p>
                  <p className="text-[15px] font-semibold leading-snug text-[var(--foreground)]">
                    {cell.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Favorite + address */}
          <div className="mb-8 flex flex-wrap items-center gap-4">
            <FavoriteToggleButton
              entityType="event"
              entityId={event.id}
              isFavorited={eventIsFavorite}
              nextPath={`/agenda/${event.slug}`}
            />
            {event.address_line_1 && (
              <p className="text-sm text-[var(--muted)]">
                {event.address_line_1}
                {event.postal_code && event.city
                  ? `, ${event.postal_code} ${event.city}`
                  : ""}
              </p>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-12 max-w-2xl whitespace-pre-wrap text-[17px] leading-relaxed text-[var(--foreground)]">
              {event.description}
            </div>
          )}

          {/* Graph: workshops at this event */}
          {workshops.length > 0 && (
            <GraphSection
              title="Boekbare workshops op dit evenement"
              subtitle="Schrijf je vooraf in. Plaatsen zijn beperkt."
            >
              <GridLayout cols={2} gap="md">
                {workshops.map((w) => (
                  <WorkshopCard key={w.id} workshop={w} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {/* Graph: creators attending */}
          {allCreators.length > 0 && (
            <GraphSection title="Makers & workshopgevers aanwezig">
              <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {allCreators.map((creator) => (
                  <li key={creator.id}>
                    <Link
                      href={`/creator/${creator.slug}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-[15px] transition-colors hover:text-[var(--accent)]"
                    >
                      <span className="font-semibold text-[var(--foreground)]">
                        {creator.display_name}
                      </span>
                      <span className="text-sm text-[var(--muted)]">
                        {creatorCategoryLabel(
                          creator,
                          roleByCreatorId.get(creator.id) ??
                            (organizer?.id === creator.id ? "organizer" : null)
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </GraphSection>
          )}

          {/* Standhouders producten — image-only masonry */}
          {masonryProducts.length > 0 ? (
            <GraphSection title="Deze staan hier ook met hun producten">
              <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
                {masonryProducts.map((product) => {
                  const imageUrl = productImageUrl(product);
                  if (!imageUrl) return null;
                  return (
                    <Link
                      key={product.id}
                      href={`/product/${product.slug}`}
                      className="mb-3 block break-inside-avoid overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                    >
                      <img
                        src={imageUrl}
                        alt={product.title}
                        className="w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </Link>
                  );
                })}
              </div>
            </GraphSection>
          ) : null}

          {/* Graph: articles */}
          {relatedArticles.length > 0 && (
            <GraphSection title="Inspiratie & voorbereiding">
              <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {relatedArticles.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/artikel/${a.slug}`}
                      className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
                    >
                      {a.featured_image_url ? (
                        <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
                          <img
                            src={a.featured_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                          {a.title}
                        </h3>
                        {a.excerpt ? (
                          <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                            {a.excerpt}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </GraphSection>
          )}

          <EventStandhouderRsvpCard
            eventId={event.id}
            eventSlug={event.slug}
            eventTitle={event.title}
            isLoggedIn={Boolean(user)}
            hasCreatorProfile={Boolean(creator)}
            isEligible={isEligible}
            hasRsvped={hasRsvped}
          />

          {/* Graph: related events */}
          {relatedEvents.length > 0 && (
            <GraphSection title="Andere evenementen in de buurt" seeAllHref="/agenda">
              <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {relatedEvents.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/agenda/${e.slug}`}
                      className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
                    >
                      {e.featured_image_url ? (
                        <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
                          <img
                            src={e.featured_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--muted)]">
                          {e.city?.trim() || e.location_name?.trim() || "Locatie volgt"}
                        </p>
                        <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                          {e.title}
                        </h3>
                      </div>
                      <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
                        Bekijk
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </GraphSection>
          )}
        </div>

        {/* Right column: ticket card */}
        <div>
          <EventTicketCard
            event={event}
            dateRangeLabel={dateLabel}
            locationLabel={locationLabel}
            allowExternalTickets={allowExternalTickets}
          />
        </div>
      </div>
    </>
  );
}

function GraphSection({
  title,
  subtitle,
  seeAllHref,
  children,
}: {
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-[15px] text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="shrink-0 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Bekijk alles
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
