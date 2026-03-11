import { notFound } from "next/navigation";
import Link from "next/link";
import { getArticlePageData } from "@/lib/services/article-page";
import { ProductCard } from "@/components/shared/ProductCard";
import { WorkshopCard } from "@/components/shared/WorkshopCard";
import { CreatorCard } from "@/components/shared/CreatorCard";
import { EventCard } from "@/components/shared/EventCard";
import { EntityLinkBlock } from "@/components/shared/EntityLinkBlock";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { article } = await getArticlePageData(slug);
  if (!article) return { title: "Niet gevonden" };
  return buildPageMetadata({
    title: article.seo_title ?? `${article.title} | Hobbysalon`,
    description: article.seo_description ?? article.excerpt ?? undefined,
    path: `/artikel/${article.slug}`,
    image: article.featured_image_url,
    type: "article",
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const data = await getArticlePageData(slug);
  if (!data.article) notFound();

  const article = data.article;
  const user = await getAuthUser();
  const articleIsFavorite = user
    ? await isFavorite(user.id, "article", article.id)
    : false;
  const articleJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt ?? undefined,
    image: article.featured_image_url
      ? [absoluteUrl(article.featured_image_url)]
      : undefined,
    datePublished: article.published_at ?? article.created_at,
    dateModified: article.updated_at,
    author: data.relatedCreators[0]
      ? {
          "@type": "Person",
          name: data.relatedCreators[0].display_name,
        }
      : {
          "@type": "Organization",
          name: "Hobbysalon",
        },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(`/artikel/${article.slug}`),
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={articleJsonLd} />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">Home</Link>
          </li>
          <li>/</li>
          <li className="text-[var(--foreground)]">{article.title}</li>
        </ol>
      </nav>

      <article>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">{article.title}</h1>
        {article.excerpt && (
          <p className="mt-4 text-lg text-[var(--muted)]">{article.excerpt}</p>
        )}
        <div className="mt-4">
          <FavoriteToggleButton
            entityType="article"
            entityId={article.id}
            isFavorited={articleIsFavorite}
            nextPath={`/artikel/${article.slug}`}
          />
        </div>
        {article.reading_time_minutes && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {article.reading_time_minutes} min lezen
          </p>
        )}
        {article.featured_image_url && (
          <div className="mt-6 aspect-video overflow-hidden rounded-lg">
            <img
              src={article.featured_image_url}
              alt={article.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        {article.body_markdown && (
          <div className="mt-8 whitespace-pre-wrap text-[var(--foreground)]">
            {article.body_markdown}
          </div>
        )}
      </article>

      <EntityLinkBlock
        title="Gerelateerde producten"
        isEmpty={data.relatedProducts.length === 0}
        emptyMessage="Geen gerelateerde producten."
      >
        {data.relatedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </EntityLinkBlock>

      <EntityLinkBlock
        title="Gerelateerde workshops"
        isEmpty={data.relatedWorkshops.length === 0}
        emptyMessage="Geen gerelateerde workshops."
      >
        {data.relatedWorkshops.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} />
        ))}
      </EntityLinkBlock>

      <EntityLinkBlock
        title="Gerelateerde creators"
        isEmpty={data.relatedCreators.length === 0}
        emptyMessage="Geen gerelateerde creators."
      >
        {data.relatedCreators.map((creator) => (
          <CreatorCard key={creator.id} creator={creator} />
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
    </div>
  );
}
