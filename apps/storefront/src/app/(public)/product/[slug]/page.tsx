import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductPageData } from "@/lib/services/product-page";
import { exactEurVariantPrice } from "@/lib/commerce/variant-price";
import { productShippingPolicies } from "@/lib/commerce/medusa/shipping";
import { CreatorCard, WorkshopCard, ArticleCard, EventCard, ProductCard, ProjectCard } from "@/components/cards";
import { EntityLinkBlock } from "@/components/shared/EntityLinkBlock";
import { ProductBuyCard } from "@/components/product/ProductBuyCard";
import { MobileBuyBar } from "@/components/product/MobileBuyBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageLayout } from "@/components/layout/page-layout";
import { AspectImage } from "@/components/ui/aspect-image";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

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

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const data = await getProductPageData(slug);

  if (!data.product) notFound();

  const { product, creator, domain, price: defaultPrice, variants, galleryImages } = data;
  // Next already decodes query values. Only an exact scalar ID from this
  // product's current variants may change the initial purchase selection.
  const requestedVariantId = (await searchParams)?.variant;
  const selectedVariant = typeof requestedVariantId === "string" && requestedVariantId
    ? variants.find((variant) => variant.id === requestedVariantId)
    : undefined;
  const selectedVariantId = selectedVariant?.id;
  // An exact link must never advertise another variant's fallback price,
  // including in JSON-LD. Without a valid link, keep the legacy page price.
  const price = selectedVariant
    ? exactEurVariantPrice(selectedVariant.exact_price)
    : defaultPrice;
  const user = await getAuthUser();
  const [productIsFavorite, shippingPolicies] = await Promise.all([
    user ? isFavorite(user.id, "product", product.id) : Promise.resolve(false),
    product.medusa_product_id
      ? productShippingPolicies(product.medusa_product_id)
      : Promise.resolve([]),
  ]);
  const productImages = [
    ...(product.featured_image_url ? [product.featured_image_url] : []),
    ...galleryImages.filter((url) => url !== product.featured_image_url),
  ];
  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.short_description ?? product.description ?? undefined,
    image:
      productImages.length > 0
        ? productImages.map((url) => absoluteUrl(url))
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
          url: absoluteUrl(`/product/${product.slug}${selectedVariantId ? `?variant=${encodeURIComponent(selectedVariantId)}` : ""}`),
        }
      : undefined,
  };

  const breadcrumbs = [
    { label: "Home", href: "/" },
    ...(product.product_type === "supply"
      ? [{ label: "Materialen", href: "/materials" } as const]
      : []),
    ...(domain ? [{ label: domain.name, href: `/${domain.slug}` } as const] : []),
    { label: product.title },
  ];

  return (
    <PageLayout breadcrumbs={breadcrumbs} size="wide" className="pb-32 md:pb-24">
      <JsonLd data={productJsonLd} />

      {/* Product: gallery left, info and buy card right */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-16">
        <div className="min-w-0">
          <AspectImage
            src={product.featured_image_url}
            alt={product.title}
            ratio="square"
            className="w-full overflow-hidden rounded-2xl shadow-[var(--shadow-md)]"
            fallbackImage="placeholderProduct"
          />
          {galleryImages.length > 0 ? (
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {galleryImages.map((url) => (
                <li key={url}>
                  <AspectImage
                    src={url}
                    alt=""
                    ratio="square"
                    className="overflow-hidden rounded-xl"
                    fallbackImage="placeholderProduct"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-8 lg:sticky lg:top-24">
          <header>
            <p className="text-sm font-semibold text-[var(--accent)]">
              {product.product_type === "handmade"
                ? "Handgemaakt"
                : product.product_type === "destash"
                  ? "Restant materiaal"
                  : "Benodigdheden"}
            </p>
            <h1 className="mt-3 text-balance font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl">
              {product.title}
            </h1>
            {creator && (
              <p className="mt-3 text-lg text-[var(--muted)]">
                door{" "}
                <Link
                  href={`/creator/${creator.slug}`}
                  className="font-semibold text-[var(--accent)] hover:underline"
                >
                  {creator.display_name}
                </Link>
              </p>
            )}
            {product.short_description && (
              <p className="mt-6 text-pretty text-lg text-[var(--foreground)]">
                {product.short_description}
              </p>
            )}
          </header>

          <div id="bestellen" className="scroll-mt-24">
          <ProductBuyCard
            product={product}
            creator={creator}
            price={price}
            variants={variants}
            selectedVariantId={selectedVariantId}
            isFavorite={productIsFavorite}
            shippingPolicies={shippingPolicies}
          />
          </div>
        </div>
      </div>

      <MobileBuyBar
        title={product.title}
        label={
          product.product_type === "supply" || product.medusa_product_id
            ? "Bestellen"
            : "Contacteer de maker"
        }
      />

      {/* Details: full width below the product */}
      {(product.description || creator) && (
        <div className="mt-16 grid gap-12 border-t border-[var(--border)] pt-12 md:mt-24 md:pt-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
          {product.description ? (
            <section className="min-w-0">
              <SectionTitle>Beschrijving</SectionTitle>
              <p className="mt-6 max-w-3xl whitespace-pre-wrap text-pretty text-lg leading-relaxed text-[var(--foreground)]">
                {product.description}
              </p>
            </section>
          ) : (
            <div />
          )}

          {creator && (
            <section>
              <SectionTitle>Maker of leverancier</SectionTitle>
              <div className="mt-6">
                <CreatorCard creator={creator} />
              </div>
            </section>
          )}
        </div>
      )}

      {data.similarProducts.length > 0 && (
        <EntityLinkBlock
          title="Dit product vind je vast ook wel leuk"
          isEmpty={false}
          columns={4}
        >
          {data.similarProducts.map((similar) => (
            <ProductCard key={similar.id} product={similar} />
          ))}
        </EntityLinkBlock>
      )}

      {data.relatedWorkshops.length > 0 && (
        <EntityLinkBlock title="Leer dit in een workshop" isEmpty={false} columns={3}>
          {data.relatedWorkshops.map((w) => (
            <WorkshopCard key={w.id} workshop={w} />
          ))}
        </EntityLinkBlock>
      )}

      {product.product_type === "handmade" && data.relatedSupplies.length > 0 && (
        <EntityLinkBlock
          title="Dit heb je nodig om verder te maken"
          isEmpty={false}
          columns={3}
        >
          {data.relatedSupplies.map((supply) => (
            <ProductCard key={supply.id} product={supply} />
          ))}
        </EntityLinkBlock>
      )}

      {data.relatedArticles.length > 0 && (
        <EntityLinkBlock title="Maak verder met dit idee" isEmpty={false} columns={3}>
          {data.relatedArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </EntityLinkBlock>
      )}

      {data.relatedProjects.length > 0 && (
        <EntityLinkBlock title="Ontdek projecten bij dit product" isEmpty={false} columns={3}>
          {data.relatedProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </EntityLinkBlock>
      )}

      {data.relatedEvents.length > 0 && (
        <EntityLinkBlock title="Ontdek het in het echt" isEmpty={false} columns={3}>
          {data.relatedEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </EntityLinkBlock>
      )}
    </PageLayout>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
        {children}
      </h2>
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}
