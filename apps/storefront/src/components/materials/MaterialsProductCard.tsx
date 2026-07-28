import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/domain/price-display";
import type { MaterialsCatalogItem } from "@/lib/platform/queries/products";

type MaterialsProductCardProps = {
  product: MaterialsCatalogItem;
  className?: string;
};

export function MaterialsProductCard({
  product,
  className,
}: MaterialsProductCardProps) {
  const price = product.displayPrice;
  const property =
    product.short_description?.trim() ||
    (product.condition_type ? `Conditie: ${product.condition_type}` : null);

  return (
    <Link
      href={`/product/${product.slug}`}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)]",
        className
      )}
    >
      <div className="aspect-square overflow-hidden bg-[var(--border)]">
        {product.featured_image_url ? (
          <img
            src={product.featured_image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="domain">{product.offer.badge}</Badge>
          {product.is_featured ? (
            <Badge variant="format">Uitgelicht</Badge>
          ) : null}
        </div>
        <h3 className="mt-2 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
          {product.title}
        </h3>
        {property ? (
          <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">{property}</p>
        ) : null}
        {product.creator_display_name ? (
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)] line-clamp-1">
            {product.creator_display_name}
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-2 pt-3">
          {price && price.amount > 0 ? (
            <PriceDisplay
              amount={price.amount}
              currencyCode={price.currency_code}
            />
          ) : (
            <span className="text-sm text-[var(--muted)]">Prijs op productpagina</span>
          )}
          <span className="text-[15px] font-bold text-[var(--accent)]">
            {product.offer.ctaLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
