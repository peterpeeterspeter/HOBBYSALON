import { CardShell } from "@/components/ui/card-shell";
import { PriceDisplay } from "@/components/domain/price-display";
import { ProductPurchaseControls } from "@/components/product/ProductPurchaseControls";
import { ProductInquiryForm } from "@/components/product/ProductInquiryForm";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { Truck, ShieldCheck, MessageCircle } from "lucide-react";
import type { Product, Creator } from "@/types/platform";

type ProductBuyCardProps = {
  product: Product;
  creator: Creator | null;
  price: { amount: number; currency_code: string } | null;
  variants: React.ComponentProps<typeof ProductPurchaseControls>["variants"];
  isFavorite: boolean;
};

/**
 * Sticky panel on the product detail page.
 * Handmade listings without Medusa = contact form (no checkout).
 * Supply / Medusa-linked products keep add-to-cart.
 */
export function ProductBuyCard({
  product,
  creator,
  price,
  variants,
  isFavorite,
}: ProductBuyCardProps) {
  const isContactListing =
    product.product_type === "handmade" && !product.medusa_product_id;

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
          {isContactListing && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Richtprijs — aankoop via de maker
            </p>
          )}
        </div>
      )}

      <div className="mt-5">
        {isContactListing && creator ? (
          <ProductInquiryForm
            productId={product.id}
            creatorId={creator.id}
            creatorName={creator.display_name}
          />
        ) : (
          <ProductPurchaseControls
            variants={variants}
            productType={product.product_type}
            creatorSlug={creator?.slug ?? null}
          />
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-[13px] text-[var(--muted)]">
        {isContactListing ? (
          <>
            <span className="flex items-center gap-2">
              <MessageCircle
                size={14}
                className="text-[var(--accent)]"
                aria-hidden
              />
              Contacteer {creator?.display_name ?? "de maker"} rechtstreeks
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck
                size={14}
                className="text-[var(--accent)]"
                aria-hidden
              />
              Geen checkout via Hobbysalon — jullie regelen de deal zelf
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <Truck size={14} className="text-[var(--accent)]" aria-hidden />
              Verzonden door {creator?.display_name ?? "de verkoper"}
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck
                size={14}
                className="text-[var(--accent)]"
                aria-hidden
              />
              Veilig betalen via Hobbysalon
            </span>
          </>
        )}
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
