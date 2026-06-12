import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductPageData } from "@/lib/services/product-page";
import { CreatorCard, WorkshopCard, ArticleCard, EventCard, ProductCard } from "@/components/cards";
import { EntityLinkBlock } from "@/components/shared/EntityLinkBlock";
import { ProductBuyCard } from "@/components/product/ProductBuyCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageLayout } from "@/components/layout/page-layout";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await getProductPageData(slug);
  if (!product) return { title: "Niet gevonden" };
  const title = product.seo_title ?? `${product.title} | Hobbysalon`;
  const description =
    product.seo_description ?? product.short_description ?? undefined;
  return buildPageMetadata({
    title,
    description,
    path: `/product/${product.slug}`,
    image: product.featured_image_url,
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductPageData(slug);

  if (!data.product) notFound();

  const { product, creator, domain, price, variants } = data;
  const user = await getAuthUser();
  const productIsFavorite = user
    ? await isFavorite(user.id, "product", product.id)
    : false;
  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.short_description ?? product.description ?? undefined,
    image: product.featured_image_url
      ? [absoluteUrl(product.featured_image_url)]
      : undefined,
    sku: product.medusa_product_id ?? product.id,
    brand: creator
      ? {
          "@type": "Brand",
          name: creator.display_name,
        }
      : undefined,
    offers: price
      ? {
          "@type": "Offer",
          priceCurrency: price.currency_code.toUpperCase(),
          price: (price.amount / 100).toFixed(2),
          availability: product.is_active
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: absoluteUrl(`/product/${product.slug}`),
        }
      : undefined,
  };

  const breadcrumbs = [
    { label: "Home", href: "/" },
    ...(domain ? [{ label: domain.name, href: `/${domain.slug}` } as const] : []),
    { label: product.title },
  ];

  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      <JsonLd data={productJsonLd} />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Main content */}
        <div className="min-w-0">
          <AspectImage
            src={product.featured_image_url}
            alt={product.title}
            ratio="square"
            className="max-w-xl overflow-hidden rounded-xl"
          />

          <div className="mt-6">
            <Badge variant="domain">
              {product.product_type === "handmade" ? "Handgemaakt" : "Benodigdheden"}
            </Badge>
            <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)] md:text-4xl">
              {product.title}
            </h1>
            {creator && (
              <p className="mt-2 text-[var(--muted)]">
                door{" "}
                <Link
                  href={`/creator/${creator.slug}`}
                  className="font-semibold text-[var(--accent)] hover:underline"
                >
                  {creator.display_name}
                </Link>
              </p>
            )}
          </div>

          {product.short_description && (
            <p className="mt-4 text-lg text-[var(--foreground)]">
              {product.short_description}
            </p>
          )}

          {product.description && (
            <section className="mt-8">
              <SectionTitle>Beschrijving</SectionTitle>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-[var(--foreground)]">
                {product.description}
              </p>
            </section>
          )}

          {creator && (
            <section className="mt-10">
              <SectionTitle>Maker / leverancier</SectionTitle>
              <div className="mt-4">
                <CreatorCard creator={creator} className="max-w-md" />
              </div>
            </section>
          )}

          <EntityLinkBlock
            title="Gerelateerde workshops"
            isEmpty={data.relatedWorkshops.length === 0}
            emptyMessage="Geen gerelateerde workshops."
          >
            {data.relatedWorkshops.map((w) => (
              <WorkshopCard key={w.id} workshop={w} />
            ))}
          </EntityLinkBlock>

          {product.product_type === "handmade" && (
            <EntityLinkBlock
              title="Relevante benodigdheden"
              isEmpty={data.relatedSupplies.length === 0}
              emptyMessage="Nog geen relevante benodigdheden."
            >
              {data.relatedSupplies.map((supply) => (
                <ProductCard key={supply.id} product={supply} />
              ))}
            </EntityLinkBlock>
          )}

          <EntityLinkBlock
            title="Gerelateerde artikelen"
            isEmpty={data.relatedArticles.length === 0}
            emptyMessage="Geen gerelateerde artikelen."
          >
            {data.relatedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
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

        {/* Sticky buy card */}
        <aside className="lg:sticky lg:top-20">
          <ProductBuyCard
            product={product}
            creator={creator}
            price={price}
            variants={variants}
            isFavorite={productIsFavorite}
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
