import Link from "next/link";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/domain/price-display";
import type { Product } from "@/types/platform";

type RowProduct = Product & {
  price?: { amount: number; currency_code: string } | null;
  creator_display_name?: string | null;
  creator_city?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  handmade: "Handgemaakt",
  supply: "Benodigdheden",
  supplies: "Benodigdheden",
};

/** Horizontal product card used by the materials marketplace list view. */
export function MaterialProductRow({ product }: { product: RowProduct }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)]"
    >
      <div className="w-40 shrink-0 sm:w-44">
        <AspectImage
          ratio="square"
          src={product.featured_image_url}
          alt={product.title}
          fallbackImage="placeholderProduct"
        />
      </div>
      <div className="flex flex-1 items-start gap-5 p-5">
        <div className="min-w-0 flex-1">
          <Badge variant="domain">
            {TYPE_LABELS[product.product_type] ?? product.product_type}
          </Badge>
          <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--foreground)] line-clamp-2">
            {product.title}
          </h3>
          {product.short_description && (
            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
              {product.short_description}
            </p>
          )}
          {(product.creator_display_name || product.creator_city) && (
            <p className="mt-2 text-sm text-[var(--muted)]">
              door{" "}
              <strong className="text-[var(--foreground)]">
                {product.creator_display_name ?? "Aanbieder"}
              </strong>
              {product.creator_city ? ` · ${product.creator_city}` : ""}
            </p>
          )}
        </div>
        {product.price && product.price.amount > 0 && (
          <div className="shrink-0 text-right">
            <PriceDisplay
              amount={product.price.amount}
              currencyCode={product.price.currency_code}
              size="lg"
            />
          </div>
        )}
      </div>
    </Link>
  );
}
