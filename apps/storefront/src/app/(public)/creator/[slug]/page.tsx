import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { getCreatorPageData } from "@/lib/services/creator-page";
import { canShowExternalLinks } from "@/lib/platform/commercial-entitlements";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { Badge } from "@/components/ui/badge";
import { JsonLd } from "@/components/seo/JsonLd";
import { CreatorProfileTabs } from "@/components/creators/CreatorProfileTabs";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { creator } = await getCreatorPageData(slug);
  if (!creator) return { title: "Niet gevonden" };
  return buildPageMetadata({
    title: `${creator.display_name} | Hobbysalon`,
    description: creator.bio ?? undefined,
    path: `/creator/${creator.slug}`,
    image: creator.avatar_url ?? creator.banner_url,
  });
}

const CREATOR_TYPE_LABELS: Record<string, string> = {
  maker: "Maker",
  workshopgever: "Workshopgever",
  supplier: "Leverancier",
  content_creator: "Content maker",
  organizer: "Organisator",
};

export default async function CreatorPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCreatorPageData(slug);
  if (!data.creator) notFound();

  const {
    creator,
    products,
    projects,
    domains,
    relatedWorkshops,
    relatedEvents,
    relatedArticles,
    relatedCreators,
    entitlements,
  } = data;

  const showExternalLinks =
    !entitlements?.gatingEnabled ||
    entitlements.segments.some((segment) =>
      canShowExternalLinks(entitlements, segment.segment)
    );

  const user = await getAuthUser();
  const creatorIsFavorite = user ? await isFavorite(user.id, "creator", creator.id) : false;

  const types = (creator.creator_types ?? []).map((t) => CREATOR_TYPE_LABELS[t] ?? t);

  const creatorUrl = absoluteUrl(`/creator/${creator.slug}`);
  const sameAs = showExternalLinks
    ? [creator.website_url, creator.instagram_url, creator.facebook_url].filter(
        (url): url is string => Boolean(url)
      )
    : [];
  const creatorJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${creatorUrl}#profile`,
    url: creatorUrl,
    name: `${creator.display_name} | Hobbysalon`,
    dateCreated: creator.created_at,
    dateModified: creator.updated_at,
    mainEntity: {
      "@type": creator.business_name ? "Organization" : "Person",
      "@id": `${creatorUrl}#creator`,
      name: creator.business_name ?? creator.display_name,
      alternateName: creator.business_name ? creator.display_name : undefined,
      description: creator.bio ?? undefined,
      image: creator.avatar_url ? absoluteUrl(creator.avatar_url) : undefined,
      url: creatorUrl,
      sameAs: sameAs.length > 0 ? sameAs : undefined,
      address:
        creator.city || creator.country_code
          ? {
              "@type": "PostalAddress",
              addressLocality: creator.city ?? undefined,
              addressCountry: creator.country_code ?? undefined,
            }
          : undefined,
      knowsAbout: domains.length > 0 ? domains.map((d) => d.name) : undefined,
    },
  };

  const stats = [
    { value: relatedWorkshops.length, label: "workshops" },
    { value: products.length, label: "producten" },
    { value: relatedEvents.length, label: "evenementen" },
    { value: relatedArticles.length, label: "artikelen" },
  ].filter((s) => s.value > 0);

  return (
    <>
      <JsonLd data={creatorJsonLd} />

      {/* Cover banner */}
      <div className="relative h-48 overflow-hidden sm:h-56 lg:h-64">
        {creator.banner_url ? (
          <img
            src={creator.banner_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--color-amber-500)] to-[var(--color-amber-700)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(77,59,42,0.4)]" />
      </div>

      {/* Profile header */}
      <div className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto max-w-6xl px-4">
          {/* Identity row */}
          <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-end">
            {/* Avatar overlapping the cover */}
            <div className="-mt-12 shrink-0 sm:-mt-14">
              <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-[var(--card)] bg-[var(--section-warm)] shadow-lg sm:h-28 sm:w-28">
                {creator.avatar_url ? (
                  <img
                    src={creator.avatar_url}
                    alt={creator.display_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--accent)]">
                    {creator.display_name.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            {/* Name, handle, domains */}
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                {creator.display_name}
              </h1>
              {(creator.business_name || creator.city) && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-[var(--muted)]">
                  {creator.business_name && <span>{creator.business_name}</span>}
                  {creator.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} aria-hidden />
                      {creator.city}
                      {creator.country_code ? `, ${creator.country_code}` : ""}
                    </span>
                  )}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {types.map((t) => (
                  <Badge key={t} variant="format">{t}</Badge>
                ))}
                {domains.map((d) => (
                  <Link key={d.id} href={`/${d.slug}`}>
                    <Badge variant="domain" className="cursor-pointer hover:opacity-90">
                      {d.name}
                    </Badge>
                  </Link>
                ))}
                {creator.is_verified && (
                  <Badge variant="new">Geverifieerd</Badge>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-2 pb-1">
              <FavoriteToggleButton
                entityType="creator"
                entityId={creator.id}
                isFavorited={creatorIsFavorite}
                nextPath={`/creator/${creator.slug}`}
              />
              {relatedWorkshops.length > 0 && (
                <Link
                  href="#workshops"
                  className="inline-flex h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Boek workshop
                </Link>
              )}
            </div>
          </div>

          {/* Stats bar */}
          {stats.length > 0 && (
            <div className="mb-4 flex overflow-hidden rounded-[10px] border border-[var(--border)]">
              {stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className={`flex-1 py-3 text-center ${i > 0 ? "border-l border-[var(--border)]" : ""}`}
                >
                  <p className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--accent)]">
                    {stat.value}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs + content */}
      <CreatorProfileTabs
        creator={creator}
        products={products}
        domains={domains}
        projects={projects}
        relatedWorkshops={relatedWorkshops}
        relatedEvents={relatedEvents}
        relatedArticles={relatedArticles}
        relatedCreators={relatedCreators}
        showExternalLinks={showExternalLinks}
      />
    </>
  );
}
