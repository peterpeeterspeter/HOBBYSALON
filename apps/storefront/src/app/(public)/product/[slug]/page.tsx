import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductPageData } from "@/lib/services/product-page";
import { CreatorCard } from "@/components/shared/CreatorCard";
import { EntityLinkBlock } from "@/components/shared/EntityLinkBlock";
import { WorkshopCard } from "@/components/shared/WorkshopCard";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await getProductPageData(slug);
  if (!product) return { title: "Niet gevonden" };
  const title = product.seo_title ?? `${product.title} | Hobbysalon`;
  const description =
    product.seo_description ?? product.short_description ?? undefined;
  return { title, description };
}

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductPageData(slug);

  if (!data.product) notFound();

  const { product, creator, domain, price, variants } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          {domain && (
            <>
              <li>/</li>
              <li>
                <Link
                  href={`/${domain.slug}`}
                  className="hover:text-[var(--foreground)]"
                >
                  {domain.name}
                </Link>
              </li>
            </>
          )}
          <li>/</li>
          <li className="text-[var(--foreground)]">{product.title}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-lg bg-[var(--border)]">
          {product.featured_image_url ? (
            <img
              src={product.featured_image_url}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
              Geen afbeelding
            </div>
          )}
        </div>
        <div>
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
            {product.product_type === "handmade" ? "Handgemaakt" : "Benodigdheden"}
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
            {product.title}
          </h1>
          {price && (
            <p className="mt-4 text-2xl font-bold text-[var(--foreground)]">
              {formatPrice(price.amount, price.currency_code)}
            </p>
          )}
          {variants.length > 1 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-[var(--muted)]">
                Varianten
              </p>
              <ul className="mt-1 space-y-1">
                {variants.map((v) => (
                  <li key={v.id} className="text-[var(--foreground)]">
                    {v.title}
                  </li>
                ))}
              </ul>
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
            {variants.length > 0 ? (
              <AddToCartButton
                variantId={variants[0]!.id}
                className="w-fit"
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Toevoegen aan winkelwagen binnenkort beschikbaar
              </p>
            )}
          </div>
        </div>
      </div>

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

      <EntityLinkBlock
        title="Gerelateerde artikelen"
        isEmpty={data.relatedArticles.length === 0}
        emptyMessage="Geen gerelateerde artikelen."
      />

      <EntityLinkBlock
        title="Gerelateerde evenementen"
        isEmpty={data.relatedEvents.length === 0}
        emptyMessage="Geen gerelateerde evenementen."
      />
    </div>
  );
}
