import { notFound } from "next/navigation";
import Link from "next/link";
import { getCreatorPageData } from "@/lib/services/creator-page";
import { ProductCard, WorkshopCard, EventCard, ArticleCard } from "@/components/cards";
import { EntityLinkBlock } from "@/components/shared/EntityLinkBlock";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { NewsletterSignupForm } from "@/components/shared/NewsletterSignupForm";
import { PageLayout } from "@/components/layout/page-layout";
import { GridLayout } from "@/components/layout/grid-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Badge } from "@/components/ui/badge";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { creator } = await getCreatorPageData(slug);
  if (!creator) return { title: "Niet gevonden" };
  const title = `${creator.display_name} | Hobbysalon`;
  const description = creator.bio ?? undefined;
  return buildPageMetadata({
    title,
    description,
    path: `/creator/${creator.slug}`,
    image: creator.avatar_url ?? creator.banner_url,
  });
}

export default async function CreatorPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCreatorPageData(slug);

  if (!data.creator) notFound();

  const { creator, products, domains, relatedWorkshops, relatedEvents, relatedArticles } = data;
  const user = await getAuthUser();
  const creatorIsFavorite = user
    ? await isFavorite(user.id, "creator", creator.id)
    : false;

  const CREATOR_TYPE_LABELS: Record<string, string> = {
    maker: "Maker",
    workshopgever: "Workshopgever",
    supplier: "Leverancier",
    content_creator: "Content maker",
    organizer: "Organisator",
  };
  const types = (creator.creator_types ?? []).map(
    (t) => CREATOR_TYPE_LABELS[t] ?? t
  );

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: creator.display_name },
  ];

  return (
    <PageLayout breadcrumbs={breadcrumbs} title={creator.display_name} description={creator.business_name ?? undefined}>
      <CardShell variant="default" padding="lg" className="mb-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--border)]">
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.display_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[var(--muted)]">
                {creator.display_name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            {types.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {types.map((t) => (
                  <Badge key={t} variant="format">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {creator.bio && (
              <p className="mt-4 text-[var(--foreground)] max-w-2xl">
                {creator.bio}
              </p>
            )}
            {(creator.city || creator.country_code) && (
              <p className="mt-3 text-sm text-[var(--muted)]">
                {creator.city ?? "Locatie onbekend"}
                {creator.country_code ? `, ${creator.country_code}` : ""}
              </p>
            )}
            <div className="mt-4">
              <FavoriteToggleButton
                entityType="creator"
                entityId={creator.id}
                isFavorited={creatorIsFavorite}
                nextPath={`/creator/${creator.slug}`}
              />
            </div>
            {domains.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {domains.map((d) => (
                  <Link key={d.id} href={`/${d.slug}`}>
                    <Badge variant="domain" className="cursor-pointer hover:opacity-90">
                      {d.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        {creator.banner_url && (
          <div className="mt-6 aspect-[3/1] overflow-hidden rounded-lg bg-[var(--border)]">
            <img src={creator.banner_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
      </CardShell>

      <section className="pb-2">
        <CardShell variant="default" padding="lg">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Contact & volg</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {creator.website_url && (
              <a
                href={creator.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)]"
              >
                Website
              </a>
            )}
            {creator.instagram_url && (
              <a
                href={creator.instagram_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)]"
              >
                Instagram
              </a>
            )}
            {creator.facebook_url && (
              <a
                href={creator.facebook_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)]"
              >
                Facebook
              </a>
            )}
            {!creator.website_url && !creator.instagram_url && !creator.facebook_url && (
              <p className="text-sm text-[var(--muted)]">
                Nog geen social of website links beschikbaar.
              </p>
            )}
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="mb-2 text-sm text-[var(--muted)]">
              Volg updates en tutorials van creators via nieuwsbrief.
            </p>
            <NewsletterSignupForm />
          </div>
        </CardShell>
      </section>

      <section className="py-8">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
          Producten
        </h2>
        <GridLayout cols={4}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          {products.length === 0 && (
            <p className="col-span-full text-[var(--muted)]">
              Nog geen producten van deze creator.
            </p>
          )}
        </GridLayout>
      </section>

      <EntityLinkBlock
        title="Workshops"
        isEmpty={relatedWorkshops.length === 0}
        emptyMessage="Workshops binnenkort beschikbaar."
      >
        {relatedWorkshops.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} />
        ))}
      </EntityLinkBlock>

      <EntityLinkBlock
        title="Events"
        isEmpty={relatedEvents.length === 0}
        emptyMessage="Events binnenkort beschikbaar."
      >
        {relatedEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </EntityLinkBlock>

      <EntityLinkBlock
        title="Artikelen & tutorials"
        isEmpty={relatedArticles.length === 0}
        emptyMessage="Artikelen en tutorials binnenkort beschikbaar."
      >
        {relatedArticles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </EntityLinkBlock>
    </PageLayout>
  );
}
