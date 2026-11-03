import Link from "next/link";
import { MapPin } from "lucide-react";
import { PriceDisplay } from "@/components/domain/price-display";
import { publicAssetUrl } from "@/lib/media/public-asset-url";
import { MATERIALS_CONDITION_OPTIONS } from "@/lib/materials/materials-catalog-helpers";
import type { MaterialsCatalogItem } from "@/lib/platform/queries/products";

function place(product: MaterialsCatalogItem): string | null {
  return product.creator_city?.trim() || null;
}

function conditionLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return MATERIALS_CONDITION_OPTIONS.find((option) => option.value === value)?.label ?? null;
}

function Price({ product, large = false }: { product: MaterialsCatalogItem; large?: boolean }) {
  const price = product.displayPrice;
  if (!price || price.amount <= 0) {
    return <span className="text-base text-[var(--muted)]">Prijs op aanvraag</span>;
  }
  return <PriceDisplay amount={price.amount} currencyCode={price.currency_code} size={large ? "lg" : "md"} />;
}

/**
 * Zelfgemaakt: a shop card. The photo leads, large and upright; below it
 * only what helps a choice: title, maker, place and price.
 */
export function HandmadeListingCard({ product }: { product: MaterialsCatalogItem }) {
  const imageUrl = publicAssetUrl(product.featured_image_url);
  const city = place(product);
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 rounded-2xl"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[var(--section-alt)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none"
          />
        ) : null}
        {product.is_featured ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-[var(--foreground)] shadow-[var(--shadow-sm)]">
            Uitgelicht
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col pt-4">
        <h3 className="text-lg font-bold leading-snug text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
          {product.title}
        </h3>
        {product.creator_display_name ? (
          <p className="mt-1 text-base text-[var(--muted)] line-clamp-1">
            door <span className="font-semibold text-[var(--foreground)]">{product.creator_display_name}</span>
            {city ? <span>, {city}</span> : null}
          </p>
        ) : null}
        <div className="mt-2">
          <Price product={product} large />
        </div>
      </div>
    </Link>
  );
}

/**
 * Overschot: a compact row. The photo is small; condition, price and where
 * it is matter more than the picture.
 */
export function DestashListingRow({ product }: { product: MaterialsCatalogItem }) {
  const imageUrl = publicAssetUrl(product.featured_image_url);
  const city = place(product);
  const condition = conditionLabel(product.condition_type);
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:gap-5 sm:p-4"
    >
      <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[var(--section-alt)] sm:size-24">
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {condition ? (
            <span className="rounded-full bg-[var(--section-highlight)] px-2.5 py-0.5 text-sm font-semibold text-[var(--accent-hover)]">
              {condition}
            </span>
          ) : null}
        </div>
        <h3 className="mt-1 text-lg font-bold leading-snug text-[var(--foreground)] line-clamp-1 group-hover:text-[var(--accent-hover)]">
          {product.title}
        </h3>
        {product.short_description ? (
          <p className="text-base text-[var(--muted)] line-clamp-1">{product.short_description}</p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-base text-[var(--muted)]">
          {product.creator_display_name ? <span className="font-semibold text-[var(--foreground)]">{product.creator_display_name}</span> : null}
          {city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={16} aria-hidden />
              {city}
            </span>
          ) : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <Price product={product} />
      </div>
    </Link>
  );
}
