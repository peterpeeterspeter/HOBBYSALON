import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, Clock, MapPin, Tag } from "lucide-react";
import { getEventPageData } from "@/lib/services/event-page";
import { canUseExternalTicketLink } from "@/lib/platform/commercial-entitlements";
import {
  CreatorCard,
  ProductCard,
  WorkshopCard,
  ArticleCard,
  EventCard,
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

type Props = { params: Promise<{ slug: string }> };

const EVENT_TYPE_LABELS: Record<string, string> = {
  handmade_market: "Handmade markt",
  hobby_fair: "Hobbybeurs",
  pop_up: "Pop-up",
  open_atelier: "Open atelier",
  workshop_day: "Workshopdag",
};

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

  const heroTags = [
    dateLabel,
    locationLabel,
    workshops.length > 0
      ? `${workshops.length} workshop${workshops.length === 1 ? "" : "s"}`
      : null,
    priceLabel,
  ].filter((t): t is string => Boolean(t));

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

  return (
    <>
      <JsonLd data={eventJsonLd} />

      {/* Hero */}
      <div className="relative h-[360px] overflow-hidden sm:h-[420px] lg:h-[460px]">
        {event.featured_image_url ? (
          <img
            src={event.featured_image_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--color-amber-500)] to-[var(--color-amber-700)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(77,59,42,0.92)] via-[rgba(77,59,42,0.35)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-8 sm:pb-9">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-[var(--accent-light)]">
              {typeLabel}
              {domains.length > 0 && ` · ${domains.map((d) => d.name).join(" · ")}`}
            </p>
            <h1 className="max-w-3xl font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[2.75rem]">
              {event.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {heroTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold text-white/90 backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Left column */}
        <div className="min-w-0">
          {/* Info bar */}
          <div className="mb-8 grid grid-cols-2 gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:grid-cols-4 sm:gap-5 sm:px-6">
            {infoCells.map((cell) => (
              <div key={cell.label} className="flex items-start gap-2.5">
                <cell.icon
                  size={18}
                  className="mt-0.5 shrink-0 text-[var(--accent)]"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
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
              tag="Workshops"
              title="Boekbare workshops op dit evenement"
              subtitle="Schrijf je vooraf in — plaatsen zijn beperkt."
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
            <GraphSection
              tag="Creators"
              title="Makers & workshopgevers aanwezig"
              subtitle="Ontmoet je favoriete creators en ontdek nieuwe makers."
              seeAllHref="/creators"
            >
              <GridLayout cols={4} gap="md">
                {allCreators.map((c) => (
                  <CreatorCard key={c.id} creator={c} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {/* Standhouders met hun producten */}
          {exhibitors.some((exhibitor) => exhibitor.products.length > 0) ? (
            <GraphSection
              tag="Marktplaats"
              title="Deze staan hier ook met hun producten"
              subtitle="Bevestigde standhouders en hun actieve aanbod."
              seeAllHref="/materials"
            >
              <div className="space-y-10">
                {exhibitors
                  .filter((exhibitor) => exhibitor.products.length > 0)
                  .map((exhibitor) => (
                    <div key={exhibitor.creator.id} className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <Link
                            href={`/creator/${exhibitor.creator.slug}`}
                            className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
                          >
                            {exhibitor.creator.display_name}
                          </Link>
                          <p className="text-sm text-[var(--muted)]">
                            {exhibitor.role === "vendor"
                              ? "Standhouder"
                              : exhibitor.role === "workshop_host"
                                ? "Workshopgever"
                                : exhibitor.role}
                          </p>
                        </div>
                        <Link
                          href={`/creator/${exhibitor.creator.slug}`}
                          className="text-sm font-semibold text-[var(--accent)] hover:underline"
                        >
                          Bekijk profiel →
                        </Link>
                      </div>
                      <GridLayout cols={4} gap="md">
                        {exhibitor.products.slice(0, 8).map((product) => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </GridLayout>
                    </div>
                  ))}
              </div>
            </GraphSection>
          ) : relatedProducts.length > 0 ? (
            <GraphSection
              tag="Marktplaats"
              title="Producten van exposerende makers"
              subtitle="Bestel alvast online of koop ter plaatse aan de stands."
              seeAllHref="/materials"
            >
              <GridLayout cols={4} gap="md">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </GridLayout>
            </GraphSection>
          ) : null}

          {/* Graph: articles */}
          {relatedArticles.length > 0 && (
            <GraphSection tag="Artikelen" title="Inspiratie & voorbereiding">
              <GridLayout cols={3} gap="md">
                {relatedArticles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </GridLayout>
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
            <GraphSection
              tag="Agenda"
              title="Andere evenementen in de buurt"
              seeAllHref="/agenda"
            >
              <GridLayout cols={3} gap="md">
                {relatedEvents.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </GridLayout>
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
  tag,
  title,
  subtitle,
  seeAllHref,
  children,
}: {
  tag: string;
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-1.5 flex items-center gap-3">
        <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--accent)]">
          {tag}
        </span>
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
          {title}
        </h2>
        <span className="hidden h-px flex-1 bg-[var(--border)] sm:block" />
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="shrink-0 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Bekijk alles →
          </Link>
        )}
      </div>
      {subtitle && <p className="mb-5 text-[15px] text-[var(--muted)]">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      {children}
    </section>
  );
}
