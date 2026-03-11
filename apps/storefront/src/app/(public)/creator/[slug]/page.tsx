import { notFound } from "next/navigation";
import Link from "next/link";
import { getCreatorPageData } from "@/lib/services/creator-page";
import { ProductCard } from "@/components/shared/ProductCard";
import { EntityLinkBlock } from "@/components/shared/EntityLinkBlock";
import { WorkshopCard } from "@/components/shared/WorkshopCard";
import { EventCard } from "@/components/shared/EventCard";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-10">
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
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              {creator.display_name}
            </h1>
            {creator.business_name && (
              <p className="text-lg text-[var(--muted)]">
                {creator.business_name}
              </p>
            )}
            {types.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {types.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-[var(--border)] px-3 py-1 text-sm font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {creator.bio && (
              <p className="mt-4 text-[var(--foreground)] max-w-2xl">
                {creator.bio}
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
                  <Link
                    key={d.id}
                    href={`/${d.slug}`}
                    className="rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
                  >
                    {d.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        {creator.banner_url && (
          <div className="mt-6 aspect-[3/1] overflow-hidden rounded-lg bg-[var(--border)]">
            <img
              src={creator.banner_url}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </header>

      <section className="py-8">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
          Producten
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          {products.length === 0 && (
            <p className="col-span-full text-[var(--muted)]">
              Nog geen producten van deze creator.
            </p>
          )}
        </div>
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
        title="Evenementen"
        isEmpty={relatedEvents.length === 0}
        emptyMessage="Evenementen binnenkort beschikbaar."
      >
        {relatedEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </EntityLinkBlock>

      <EntityLinkBlock
        title="Artikelen"
        isEmpty={relatedArticles.length === 0}
        emptyMessage="Artikelen binnenkort beschikbaar."
      >
        {relatedArticles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </EntityLinkBlock>
    </div>
  );
}
