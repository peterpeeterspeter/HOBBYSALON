import Link from "next/link";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/domain/price-display";
import { publicAssetUrl } from "@/lib/media/public-asset-url";
import type { Product } from "@/types/platform";

type ProductCardProps = {
  product: Product & {
    price?: { amount: number; currency_code: string } | null;
    creator_display_name?: string | null;
    creator_slug?: string | null;
    creator_city?: string | null;
    creator_country_code?: string | null;
    creator_types?: string[];
  };
  className?: string;
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  handmade: "Handgemaakt",
  supply: "Benodigdheden",
  supplies: "Benodigdheden",
};

function getSellerTypeLabel(types?: string[]) {
  if (!types || types.length === 0) return null;
  if (types.includes("supplier")) return "Leverancier";
  if (types.includes("maker")) return "Maker";
  return null;
}

function ProductCard({ product, className }: ProductCardProps) {
  const sellerTypeLabel = getSellerTypeLabel(product.creator_types);
  const imageUrl = publicAssetUrl(product.featured_image_url);

  return (
    <Link href={`/product/${product.slug}`} className={cn("block", className)}>
      <CardShell variant="interactive" padding="md">
        <AspectImage
          ratio="square"
          src={imageUrl}
          alt={product.title}
          fallbackImage="placeholderProduct"
          className="-mx-4 -mt-4 mb-3"
        />
        <Badge variant="domain">
          {PRODUCT_TYPE_LABELS[product.product_type] ?? product.product_type}
        </Badge>
        <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
          {product.title}
        </h3>
        {(product.creator_display_name || product.creator_city) && (
          <p className="mt-1 text-sm text-[var(--muted)] line-clamp-1">
            {product.creator_slug ? (
              <span>
                <span className="underline decoration-dotted underline-offset-2">
                  {product.creator_display_name ?? "Aanbieder"}
                </span>
                {sellerTypeLabel ? ` (${sellerTypeLabel})` : ""}
                {product.creator_city ? ` · ${product.creator_city}` : ""}
              </span>
            ) : (
              <span>
                {product.creator_display_name ?? "Aanbieder"}
                {sellerTypeLabel ? ` (${sellerTypeLabel})` : ""}
                {product.creator_city ? ` · ${product.creator_city}` : ""}
              </span>
            )}
          </p>
        )}
        {product.price && product.price.amount > 0 && (
          <PriceDisplay
            amount={product.price.amount}
            currencyCode={product.price.currency_code}
            size="lg"
            className="mt-2"
          />
        )}
      </CardShell>
    </Link>
  );
}

export { ProductCard };
export type { ProductCardProps };
