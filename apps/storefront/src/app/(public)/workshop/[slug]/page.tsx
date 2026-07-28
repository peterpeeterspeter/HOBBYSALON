import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkshopPageData } from "@/lib/services/workshop-page";
import { canUseExternalBookingLink } from "@/lib/platform/commercial-entitlements";
import { CreatorCard, ProductCard, EventCard, ArticleCard } from "@/components/cards";
import { EntityLinkBlock } from "@/components/shared/EntityLinkBlock";
import { WorkshopBookingCard } from "@/components/workshop/WorkshopBookingCard";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { DifficultyIndicator } from "@/components/domain/difficulty-indicator";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
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

  const { workshop, creator, domain, sessions, galleryImages, requiredProducts, optionalProducts, entitlements } =
    data;
  const user = await getAuthUser();
  const workshopIsFavorite = user
    ? await isFavorite(user.id, "workshop", workshop.id)
    : false;
  const workshopUrl = absoluteUrl(`/workshop/${workshop.slug}`);
  const allowExternalBooking = entitlements
    ? canUseExternalBookingLink(entitlements)
    : true;
  const offerUrl =
    allowExternalBooking && workshop.booking_url
      ? workshop.booking_url
      : workshopUrl;
  const courseMode =
    workshop.format_type === "physical"
      ? "onsite"
      : workshop.format_type === "online"
        ? "online"
        : "blended";
  const workshopJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${workshopUrl}#course`,
    url: workshopUrl,
    name: workshop.title,
    description:
      workshop.description ?? workshop.short_description ?? undefined,
    image: workshop.featured_image_url
      ? absoluteUrl(workshop.featured_image_url)
      : undefined,
    courseMode,
    educationalLevel:
      DIFFICULTY_LABELS[workshop.difficulty_level] ??
      workshop.difficulty_level,
    timeRequired: workshop.duration_minutes
      ? `PT${workshop.duration_minutes}M`
      : undefined,
    about: domain
      ? {
          "@type": "Thing",
          name: domain.name,
        }
      : undefined,
    provider: creator
      ? {
          "@type": creator.business_name ? "Organization" : "Person",
          name: creator.business_name ?? creator.display_name,
          url: absoluteUrl(`/creator/${creator.slug}`),
        }
      : {
          "@type": "Organization",
          name: "Hobbysalon",
          url: absoluteUrl("/"),
        },
    offers: {
      "@type": "Offer",
      url: offerUrl,
      price: workshop.price_cents / 100,
      priceCurrency: workshop.currency_code.toUpperCase(),
      availability: "https://schema.org/InStock",
    },
    hasCourseInstance: sessions.map((session) => ({
      "@type": "CourseInstance",
      courseMode,
      startDate: session.starts_at,
      endDate: session.ends_at,
      eventStatus: "https://schema.org/EventScheduled",
      location:
        workshop.format_type === "online"
          ? {
              "@type": "VirtualLocation",
              url: offerUrl,
            }
          : workshop.location_name || workshop.city || workshop.country_code
            ? {
                "@type": "Place",
                name: workshop.location_name ?? undefined,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: workshop.city ?? undefined,
                  addressCountry: workshop.country_code ?? undefined,
                },
              }
            : undefined,
      offers: {
        "@type": "Offer",
        url: offerUrl,
        price: workshop.price_cents / 100,
        priceCurrency: workshop.currency_code.toUpperCase(),
        availability:
          session.remaining_spots === 0
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
      },
    })),
  };

  const breadcrumbs = [
    { label: "Home", href: "/" },
    ...(domain ? [{ label: domain.name, href: `/${domain.slug}` } as const] : []),
    { label: workshop.title },
  ];

  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      <JsonLd data={workshopJsonLd} />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Main content */}
        <div className="min-w-0">
          <AspectImage
            src={workshop.featured_image_url}
            alt={workshop.title}
            ratio="video"
            className="overflow-hidden rounded-xl"
          />

          {galleryImages.length > 0 ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {galleryImages.map((image) => (
                <li key={image.id}>
                  <AspectImage
                    src={image.image_url}
                    alt={image.alt_text ?? workshop.title}
                    ratio="square"
                    className="overflow-hidden rounded-lg"
                  />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {domain && <Badge variant="domain">{domain.name}</Badge>}
            <Badge variant="format">
              {FORMAT_LABELS[workshop.format_type] ?? workshop.format_type}
            </Badge>
            <DifficultyIndicator level={workshop.difficulty_level} />
          </div>

          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)] md:text-4xl">
            {workshop.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            {creator && (
              <span className="text-[var(--muted)]">
                door{" "}
                <Link
                  href={`/creator/${creator.slug}`}
                  className="font-semibold text-[var(--accent)] hover:underline"
                >
                  {creator.display_name}
                </Link>
              </span>
            )}
            <FavoriteToggleButton
              entityType="workshop"
              entityId={workshop.id}
              isFavorited={workshopIsFavorite}
              nextPath={`/workshop/${workshop.slug}`}
            />
          </div>

          {workshop.description && (
            <section className="mt-8">
              <SectionTitle>Over de workshop</SectionTitle>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-[var(--foreground)]">
                {workshop.description}
              </p>
            </section>
          )}

          {sessions.length > 0 && (
            <section className="mt-10">
              <SectionTitle>Beschikbare data</SectionTitle>
              <ul className="mt-4 space-y-3">
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
                              ? "rounded-full bg-[var(--success)]/15 px-3 py-1 text-sm font-medium text-[var(--success)]"
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
            <section className="mt-10">
              <SectionTitle>Workshopgever</SectionTitle>
              <div className="mt-4">
                <CreatorCard creator={creator} className="max-w-md" />
              </div>
            </section>
          )}

          {requiredProducts.length > 0 && (
            <EntityLinkBlock title="Goed voorbereid: dit heb je nodig" isEmpty={false}>
              {requiredProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </EntityLinkBlock>
          )}

          {optionalProducts.length > 0 && (
            <EntityLinkBlock title="Handig om mee te nemen" isEmpty={false}>
              {optionalProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </EntityLinkBlock>
          )}

          {data.relatedEvents.length > 0 && (
            <EntityLinkBlock title="Ontdek het in het echt" isEmpty={false}>
              {data.relatedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </EntityLinkBlock>
          )}

          {data.relatedArticles.length > 0 && (
            <EntityLinkBlock title="Lees en maak verder" isEmpty={false}>
              {data.relatedArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </EntityLinkBlock>
          )}
        </div>

        {/* Sticky booking card */}
        <aside className="lg:sticky lg:top-20">
          <WorkshopBookingCard
            workshop={workshop}
            creator={creator}
            sessions={sessions}
            allowExternalBooking={allowExternalBooking}
          />
        </aside>
      </div>
    </PageLayout>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
        {children}
      </h2>
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}
