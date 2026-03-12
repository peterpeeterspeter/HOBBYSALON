import Link from "next/link";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/domain/price-display";
import type { Product } from "@/types/platform";

type ProductCardProps = {
  product: Product & {
    price?: { amount: number; currency_code: string } | null;
  };
  className?: string;
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  handmade: "Handgemaakt",
  supplies: "Benodigdheden",
};

function ProductCard({ product, className }: ProductCardProps) {
  return (
    <Link href={`/product/${product.slug}`} className={cn("block", className)}>
      <CardShell variant="interactive" padding="md">
        <AspectImage
          ratio="square"
          src={product.featured_image_url}
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
