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

const MAKER_LISTING_TYPES = new Set(["handmade", "destash"]);

const TYPE_LABELS: Record<string, string> = {
  handmade: "Handgemaakt",
  destash: "Restant materiaal",
};

/**
 * Sticky panel on the product detail page: type, price and either an
 * add-to-cart flow (merchant supply, or a legacy Medusa-linked maker
 * listing) or a contact/inquire form (maker listing without a cart).
 */
export function ProductBuyCard({
  product,
  creator,
  price,
  variants,
  isFavorite,
}: ProductBuyCardProps) {
  const isMakerListing = MAKER_LISTING_TYPES.has(product.product_type);
  const hasCart = !isMakerListing || !!product.medusa_product_id;

  return (
    <CardShell variant="default" padding="lg" className="rounded-2xl">
      <span className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
        {TYPE_LABELS[product.product_type] ?? "Benodigdheden"}
      </span>

      {price && (
        <div className="mt-3">
          <PriceDisplay
            amount={price.amount}
            currencyCode={price.currency_code}
            size="lg"
          />
          {isMakerListing && !hasCart && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Richtprijs — aankoop via de maker
            </p>
          )}
        </div>
      )}

      <div className="mt-5">
        {hasCart ? (
          <ProductPurchaseControls
            variants={variants}
            productType={product.product_type}
            creatorSlug={creator?.slug ?? null}
          />
        ) : creator ? (
          <ProductInquiryForm
            productId={product.id}
            creatorId={creator.id}
            creatorName={creator.display_name}
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Contact opnemen is voor dit item nog niet beschikbaar.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-[13px] text-[var(--muted)]">
        {hasCart ? (
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
        ) : (
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
