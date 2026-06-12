import { CardShell } from "@/components/ui/card-shell";
import { PriceDisplay } from "@/components/domain/price-display";
import { ProductPurchaseControls } from "@/components/product/ProductPurchaseControls";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { Truck, ShieldCheck } from "lucide-react";
import type { Product, Creator } from "@/types/platform";

type ProductBuyCardProps = {
  product: Product;
  creator: Creator | null;
  price: { amount: number; currency_code: string } | null;
  variants: React.ComponentProps<typeof ProductPurchaseControls>["variants"];
  isFavorite: boolean;
};

/**
 * Sticky purchase panel on the product detail page: type, price, variant
 * selection + add-to-cart, reassurance lines and a favourite toggle.
 */
export function ProductBuyCard({
  product,
  creator,
  price,
  variants,
  isFavorite,
}: ProductBuyCardProps) {
  return (
    <CardShell variant="default" padding="lg" className="rounded-2xl">
      <span className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
        {product.product_type === "handmade" ? "Handgemaakt" : "Benodigdheden"}
      </span>

      {price && (
        <div className="mt-3">
          <PriceDisplay
            amount={price.amount}
            currencyCode={price.currency_code}
            size="lg"
          />
        </div>
      )}

      <div className="mt-5">
        <ProductPurchaseControls
          variants={variants}
          productType={product.product_type}
          creatorSlug={creator?.slug ?? null}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-[13px] text-[var(--muted)]">
        <span className="flex items-center gap-2">
          <Truck size={14} className="text-[var(--accent)]" aria-hidden />
          Verzonden door {creator?.display_name ?? "de verkoper"}
        </span>
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[var(--accent)]" aria-hidden />
          Veilig betalen via Hobbysalon
        </span>
      </div>

      <div className="mt-4">
        <FavoriteToggleButton
          entityType="product"
          entityId={product.id}
          isFavorited={isFavorite}
          nextPath={`/product/${product.slug}`}
        />
      </div>
    </CardShell>
  );
}
