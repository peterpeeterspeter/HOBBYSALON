import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductPageData } from "@/lib/services/product-page";
import { CreatorCard, WorkshopCard, ArticleCard, EventCard, ProductCard } from "@/components/cards";
import { EntityLinkBlock } from "@/components/shared/EntityLinkBlock";
import { ProductPurchaseControls } from "@/components/product/ProductPurchaseControls";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageLayout } from "@/components/layout/page-layout";
import { SplitLayout } from "@/components/layout/split-layout";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { PriceDisplay } from "@/components/domain/price-display";
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
    <PageLayout
      breadcrumbs={breadcrumbs}
      title={product.title}
      description={product.short_description ?? undefined}
    >
      <JsonLd data={productJsonLd} />
      <SplitLayout
        sidebar={
          <div className="space-y-4">
            <AspectImage src={product.featured_image_url} alt={product.title} ratio="square" />
            <FavoriteToggleButton
              entityType="product"
              entityId={product.id}
              isFavorited={productIsFavorite}
              nextPath={`/product/${product.slug}`}
            />
          </div>
        }
      >
        <CardShell variant="default" padding="lg">
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
            {product.product_type === "handmade" ? "Handgemaakt" : "Benodigdheden"}
          </span>
          {price && (
            <div className="mt-4">
              <PriceDisplay amount={price.amount} currencyCode={price.currency_code} size="lg" />
            </div>
          )}
          {product.short_description && (
            <p className="mt-4 text-[var(--foreground)]">
              {product.short_description}
            </p>
          )}
          {product.description && (
            <p className="mt-4 whitespace-pre-wrap text-[var(--foreground)]">
              {product.description}
            </p>
          )}
          <div className="mt-6">
            <ProductPurchaseControls variants={variants} />
          </div>
        </CardShell>
      </SplitLayout>

      {creator && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Maker / leverancier
          </h2>
          <CreatorCard creator={creator} className="max-w-md" />
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
    </PageLayout>
  );
}
