import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/platform";

type ProductCardProps = {
  product: Product & { price?: { amount: number; currency_code: string } | null };
  className?: string;
};

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export function ProductCard({ product, className }: ProductCardProps) {
  const priceStr = product.price
    ? formatPrice(product.price.amount, product.price.currency_code)
    : null;

  return (
    <Link
      href={`/product/${product.slug}`}
      className={cn(
        "block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md",
        className
      )}
    >
      <div className="aspect-square mb-3 overflow-hidden rounded-md bg-[var(--border)]">
        {product.featured_image_url ? (
          <img
            src={product.featured_image_url}
            alt={product.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--muted)] text-sm">
            Geen afbeelding
          </div>
        )}
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
        {product.product_type === "handmade" ? "Handgemaakt" : "Benodigdheden"}
      </span>
      <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
        {product.title}
      </h3>
      {priceStr && (
        <p className="mt-2 text-xl font-bold text-[var(--foreground)]">{priceStr}</p>
      )}
    </Link>
  );
}
