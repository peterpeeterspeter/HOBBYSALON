import Link from "next/link";
import { PriceDisplay } from "@/components/domain/price-display";
import { publicAssetUrl } from "@/lib/media/public-asset-url";
import type { MaterialsCatalogItem } from "@/lib/platform/queries/products";
import { HomeReveal } from "./HomeReveal";

type HomeProductRailProps = {
  title: string;
  lead: string;
  href: string;
  ctaLabel: string;
  products: MaterialsCatalogItem[];
};

function formatRailPrice(product: MaterialsCatalogItem): {
  amount: number;
  currency: string;
} | null {
  const fromDisplay = product.displayPrice;
  if (fromDisplay && fromDisplay.amount > 0) {
    return {
      amount: fromDisplay.amount,
      currency: fromDisplay.currency_code,
    };
  }
  if (typeof product.price_cents === "number" && product.price_cents > 0) {
    return {
      amount: product.price_cents,
      currency: product.currency_code ?? "eur",
    };
  }
  return null;
}

export function HomeProductRail({
  title,
  lead,
  href,
  ctaLabel,
  products,
}: HomeProductRailProps) {
  if (products.length === 0) return null;

  return (
    <HomeReveal>
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
              {lead}
            </p>
          </div>
          <Link
            href={href}
            className="inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
          >
            {ctaLabel}
          </Link>
        </div>

        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-smooth sm:-mx-6 sm:gap-5 sm:px-6 [scrollbar-width:thin]">
          {products.map((product) => {
            const imageUrl = publicAssetUrl(product.featured_image_url);
            const price = formatRailPrice(product);
            const maker = product.creator_display_name?.trim() || null;

            return (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className="group w-44 shrink-0 snap-start sm:w-52"
              >
                <div className="relative aspect-square overflow-hidden rounded-[1.25rem] bg-[var(--section-alt)]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {product.offer.badge}
                </p>
                <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold leading-snug text-[var(--foreground)] line-clamp-2">
                  {product.title}
                </h3>
                {maker ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)] line-clamp-1">
                    {maker}
                  </p>
                ) : null}
                <div className="mt-2">
                  {price ? (
                    <PriceDisplay
                      amount={price.amount}
                      currencyCode={price.currency}
                      size="sm"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-[var(--muted)]">
                      Prijs op productpagina
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </HomeReveal>
  );
}
