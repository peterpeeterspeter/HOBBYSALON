import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, BadgeCheck } from "lucide-react";
import { getCreatorPageData } from "@/lib/services/creator-page";
import { canShowExternalLinks } from "@/lib/platform/commercial-entitlements";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { Badge } from "@/components/ui/badge";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  AboutBlock,
  ArticleGrid,
  EventList,
  ProductGrid,
  ProfileSection,
  ProjectGrid,
  RelatedCreators,
  WorkshopGrid,
} from "@/components/creators/CreatorProfileSections";
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
  supplier: "Winkel",
  content_creator: "Contentmaker",
  organizer: "Organisator",
};

const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)] transition-colors duration-300 hover:bg-[var(--accent-hover)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export default async function CreatorPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCreatorPageData(slug);
  if (!data.creator) notFound();

  const {
    creator,
    products,
    projects,
    domains,
    relatedWorkshops: workshops,
    relatedEvents: events,
    relatedArticles: articles,
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
  const isOwner = Boolean(user && creator.user_id && user.id === creator.user_id);

  const name = creator.display_name;
  // First line of the bio as a short intro. The full bio is under "Over".
  const intro =
    creator.bio
      ?.split(/\n+/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.replace(/[:;,]$/, "") ?? null;
  const bioHasMore = Boolean(creator.bio && creator.bio.trim() !== intro);
  const hasLinks =
    showExternalLinks &&
    Boolean(creator.website_url || creator.instagram_url || creator.facebook_url);
  const showAbout = bioHasMore || Boolean(creator.city) || hasLinks;
  const types = (creator.creator_types ?? []).map((t) => CREATOR_TYPE_LABELS[t] ?? t);

  // Offer sections first, in the order a visitor acts on them.
  const sections = [
    { id: "workshops", label: "Workshops", count: workshops.length },
    { id: "te-koop", label: "Te koop", count: products.length },
    { id: "creaties", label: "Creaties", count: projects.length },
    { id: "agenda", label: "Agenda", count: events.length },
    { id: "uitleg", label: "Uitleg en patronen", count: articles.length },
  ].filter((s) => s.count > 0);

  const primaryAction =
    workshops.length > 0
      ? { href: "#workshops", label: "Bekijk de workshops" }
      : products.length > 0
        ? { href: "#te-koop", label: "Bekijk wat te koop is" }
        : articles.length > 0
          ? { href: "#uitleg", label: "Lees de uitleg" }
          : null;

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
    name: `${name} | Hobbysalon`,
    dateCreated: creator.created_at,
    dateModified: creator.updated_at,
    mainEntity: {
      "@type": creator.business_name ? "Organization" : "Person",
      "@id": `${creatorUrl}#creator`,
      name: creator.business_name ?? name,
      alternateName: creator.business_name ? name : undefined,
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

  return (
    <>
      <JsonLd data={creatorJsonLd} />

      {/* Cover: a real banner, or a short flat band so the page does not open on an empty block. */}
      {creator.banner_url ? (
        <div className="h-48 overflow-hidden bg-[var(--section-warm)] sm:h-64 lg:h-72">
          <img src={creator.banner_url} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-24 bg-[var(--section-warm)] sm:h-32" aria-hidden />
      )}

      {/* Hero */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto max-w-6xl px-4 pb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="-mt-16 shrink-0">
              <div className="h-32 w-32 overflow-hidden rounded-3xl border-4 border-[var(--card)] bg-[var(--section-alt)] shadow-[var(--shadow-md)] sm:h-40 sm:w-40">
                {creator.avatar_url ? (
                  <img src={creator.avatar_url} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-[family-name:var(--font-heading)] text-5xl font-bold text-[var(--accent)]">
                    {name.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-x-3 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)] [text-wrap:balance] sm:text-4xl">
                {name}
                {creator.is_verified ? (
                  <BadgeCheck size={28} className="text-[var(--accent)]" aria-label="Geverifieerd" />
                ) : null}
              </h1>
              {(creator.business_name || creator.city || types.length > 0) && (
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg text-[var(--muted)]">
                  {types.length > 0 ? <span>{joinRoles(types)}</span> : null}
                  {creator.business_name && creator.business_name !== name ? (
                    <span>{creator.business_name}</span>
                  ) : null}
                  {creator.city ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={18} aria-hidden />
                      {creator.city}
                      {creator.country_code ? `, ${creator.country_code}` : ""}
                    </span>
                  ) : null}
                </p>
              )}
            </div>
          </div>

          {intro ? (
            <p className="mt-6 max-w-[680px] text-lg leading-relaxed text-[var(--foreground)] line-clamp-2 [text-wrap:pretty]">
              {intro}
            </p>
          ) : null}

          {domains.length > 0 || (creator.specialty_tags ?? []).length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {domains.map((d) => (
                <Link key={d.id} href={`/${d.slug}`}>
                  <Badge variant="domain" className="cursor-pointer hover:opacity-90">
                    {d.name}
                  </Badge>
                </Link>
              ))}
              {(creator.specialty_tags ?? []).map((tag) => (
                <Badge key={tag} variant="domain">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            {primaryAction ? (
              <Link href={primaryAction.href} className={primaryButton}>
                {primaryAction.label}
              </Link>
            ) : null}
            <FavoriteToggleButton
              entityType="creator"
              entityId={creator.id}
              isFavorited={creatorIsFavorite}
              nextPath={`/creator/${creator.slug}`}
            />
          </div>

          {sections.length > 1 ? (
            <nav aria-label={`Op de pagina van ${name}`} className="mt-8">
              <ul className="flex flex-wrap gap-2">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 text-base font-semibold text-[var(--foreground)] transition-colors duration-300 hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      {s.label}
                      <span className="rounded-full bg-[var(--accent)]/10 px-2 text-sm font-bold text-[var(--accent)]">
                        {s.count}
                      </span>
                    </a>
                  </li>
                ))}
                {showAbout ? (
                <li>
                  <a
                    href="#over"
                    className="inline-flex min-h-12 items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-4 text-base font-semibold text-[var(--foreground)] transition-colors duration-300 hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    Over {name}
                  </a>
                </li>
                ) : null}
              </ul>
            </nav>
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-12">
        {isOwner ? <OwnerPanel name={name} isEmpty={sections.length === 0} /> : null}

        {workshops.length > 0 ? (
          <ProfileSection
            id="workshops"
            title={`Workshops bij ${name}`}
            lead="Kies een workshop en schrijf je meteen in."
          >
            <WorkshopGrid workshops={workshops} />
          </ProfileSection>
        ) : null}

        {products.length > 0 ? (
          <ProfileSection
            id="te-koop"
            title="Te koop"
            lead={`Zelfgemaakt werk en materialen van ${name}.`}
          >
            <ProductGrid products={products} />
          </ProfileSection>
        ) : null}

        {projects.length > 0 ? (
          <ProfileSection id="creaties" title="Creaties" lead={`Werk dat ${name} maakte.`}>
            <ProjectGrid projects={projects} />
          </ProfileSection>
        ) : null}

        {events.length > 0 ? (
          <ProfileSection
            id="agenda"
            title={`Hier vind je ${name}`}
            lead="Markten, beurzen en evenementen."
          >
            <EventList events={events} />
          </ProfileSection>
        ) : null}

        {articles.length > 0 ? (
          <ProfileSection
            id="uitleg"
            title="Uitleg en patronen"
            lead={`Tutorials en patronen van ${name}.`}
          >
            <ArticleGrid articles={articles} />
          </ProfileSection>
        ) : null}

        {sections.length === 0 && !isOwner ? (
          <EmptyOffer name={name} />
        ) : null}

        {showAbout ? (
          <ProfileSection id="over" title={`Over ${name}`}>
            <AboutBlock
              creator={creator}
              showBio={bioHasMore}
              showExternalLinks={showExternalLinks}
            />
          </ProfileSection>
        ) : null}
      </div>

      <RelatedCreators creators={relatedCreators} />
    </>
  );
}

function EmptyOffer({ name }: { name: string }) {
  return (
    <section
      aria-labelledby="empty-title"
      className="rounded-2xl border border-[var(--border)] bg-[var(--section-highlight)] p-6 sm:p-8"
    >
      <h2
        id="empty-title"
        className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]"
      >
        {name} zet binnenkort aanbod online
      </h2>
      <p className="mt-2 max-w-2xl text-lg text-[var(--muted)] [text-wrap:pretty]">
        Er staan nog geen workshops of producten op deze pagina. Bewaar {name} bovenaan
        als favoriet, dan vind je deze pagina snel terug.
      </p>
      <div className="mt-6">
        <Link
          href="/workshops"
          className="text-base font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
        >
          Bekijk andere workshops
        </Link>
      </div>
    </section>
  );
}

function OwnerPanel({ name, isEmpty }: { name: string; isEmpty: boolean }) {
  const actions = [
    { href: "/dashboard/workshops/nieuw", label: "Workshop toevoegen" },
    { href: "/dashboard/products/nieuw", label: "Product toevoegen" },
    { href: "/dashboard/pagina", label: "Pagina bewerken" },
  ];
  return (
    <section
      aria-labelledby="owner-title"
      className="rounded-2xl border border-[var(--accent)] bg-[var(--section-highlight)] p-6 sm:p-8"
    >
      <h2
        id="owner-title"
        className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]"
      >
        Dit is jouw pagina, {name}
      </h2>
      <p className="mt-2 max-w-2xl text-lg text-[var(--muted)] [text-wrap:pretty]">
        {isEmpty
          ? "Bezoekers zien nog geen aanbod. Voeg een workshop of product toe, dan verschijnt het hier vanzelf."
          : "Alleen jij ziet dit blok. Nieuw aanbod verschijnt hier vanzelf."}
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        {actions.map((a, i) => (
          <Link
            key={a.href}
            href={a.href}
            className={
              i === 0
                ? primaryButton
                : "inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 text-base font-semibold text-[var(--foreground)] transition-colors duration-300 hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            }
          >
            {a.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** "Maker, workshopgever en winkel": first word capitalised, the rest lower case. */
function joinRoles(roles: string[]): string {
  const words = roles.map((r, i) => (i === 0 ? r : r.toLowerCase()));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} en ${words[words.length - 1]}`;
}
