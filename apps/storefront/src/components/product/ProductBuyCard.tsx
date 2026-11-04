import { productShippingPolicies } from "@/lib/commerce/medusa/shipping";
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
  selectedVariantId?: string;
  isFavorite: boolean;
};

const MAKER_LISTING_TYPES = new Set(["handmade", "destash"]);

/**
 * Sticky panel on the product detail page: type, price and either an
 * add-to-cart flow (merchant supply, or a legacy Medusa-linked maker
 * listing) or a contact/inquire form (maker listing without a cart).
 */
export async function ProductBuyCard({
  product,
  creator,
  price,
  variants,
  selectedVariantId,
  isFavorite,
}: ProductBuyCardProps) {
  const shippingPolicies = product.medusa_product_id ? await productShippingPolicies(product.medusa_product_id) : [];
  const isMakerListing = MAKER_LISTING_TYPES.has(product.product_type);
  const hasCart = !isMakerListing || !!product.medusa_product_id;

  return (
    <CardShell
      variant="default"
      padding="lg"
      className="rounded-2xl border-[var(--accent)]/25 bg-[var(--section-highlight)] shadow-[var(--shadow-md)]"
    >
      {price && !hasCart && (
        <div className="mb-6">
          <PriceDisplay
            amount={price.amount}
            currencyCode={price.currency_code}
            size="lg"
          />
          {isMakerListing && (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Richtprijs. Aankoop via de maker
            </p>
          )}
        </div>
      )}

      <div>
        {hasCart ? (
          <ProductPurchaseControls
            key={selectedVariantId ? `variant:${selectedVariantId}` : "default"}
            variants={variants}
            selectedVariantId={selectedVariantId}
            productType={product.product_type}
            creatorSlug={creator?.slug ?? null}
            fallbackPrice={price}
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

      {hasCart && shippingPolicies.map(policy => <p key={policy.country_code} className="mt-4 text-sm text-[var(--muted)]">Gratis standaardverzending {policy.threshold_amount === 0 ? "" : `vanaf ${new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(policy.threshold_amount)} `}naar {policy.country_code === "be" ? "België" : "Nederland"} bij deze verkoper.</p>)}
      <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
        {hasCart ? (
          <>
            <span className="flex items-center gap-3">
              <Truck size={18} className="text-[var(--accent)]" aria-hidden />
              Verzonden door {creator?.display_name ?? "de verkoper"}
            </span>
            <span className="flex items-center gap-3">
              <ShieldCheck
                size={18}
                className="text-[var(--accent)]"
                aria-hidden
              />
              Veilig betalen via Hobbysalon
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-3">
              <MessageCircle
                size={18}
                className="text-[var(--accent)]"
                aria-hidden
              />
              Contacteer {creator?.display_name ?? "de maker"} rechtstreeks
            </span>
            <span className="flex items-center gap-3">
              <ShieldCheck
                size={18}
                className="text-[var(--accent)]"
                aria-hidden
              />
              Je betaalt niet via Hobbysalon. Jullie spreken de verkoop zelf af
            </span>
          </>
        )}
      </div>

      <div className="mt-6">
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
