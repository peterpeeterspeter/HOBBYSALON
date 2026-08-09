import { cookies } from "next/headers";
import Link from "next/link";
import { CART_COOKIE_NAME, getCart } from "@/lib/commerce/medusa/cart";
import { medusaAmountToCents } from "@/lib/commerce/money";
import { RemoveFromCartButton } from "@/components/cart/RemoveFromCartButton";
import { CartItemQuantityControl } from "@/components/cart/CartItemQuantityControl";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/domain/price-display";

export const dynamic = "force-dynamic";

type CartItem = {
  id?: string;
  variant?: { id?: string; title?: string; product?: { title?: string } };
  unit_price?: number;
  quantity?: number;
  total?: number;
  title?: string;
  metadata?: Record<string, unknown>;
};

export default async function CartPage() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!cartId) {
    return (
      <PageLayout title="Winkelwagen" description="Je winkelwagen is leeg. Ontdek onze producten en voeg iets toe." size="narrow">
        <Button asChild>
          <Link href="/materials">Verder winkelen</Link>
        </Button>
      </PageLayout>
    );
  }

  const cart = await getCart(cartId);

  if (!cart || !cart.items?.length) {
    return (
      <PageLayout title="Winkelwagen" description="Je winkelwagen is leeg. Ontdek onze producten en voeg iets toe." size="narrow">
        <Button asChild>
          <Link href="/materials">Verder winkelen</Link>
        </Button>
      </PageLayout>
    );
  }

  const currencyCode = (cart as { currency_code?: string }).currency_code ?? "eur";
  const items = (cart.items ?? []) as CartItem[];
  const cartSubtotal = (cart as { subtotal?: number }).subtotal;
  const subtotalCents = medusaAmountToCents(
    cartSubtotal ??
      items.reduce((sum: number, item: CartItem) => {
        const unitPrice = item.unit_price ?? 0;
        const qty = item.quantity ?? 1;
        return sum + unitPrice * qty;
      }, 0)
  );

  return (
    <PageLayout title="Winkelwagen" size="narrow">
      <div className="space-y-6">
        {items.map((i: CartItem) => {
          const variant = i.variant as {
            id: string;
            title?: string;
            product?: { title?: string };
          };
          const bundleId =
            typeof i.metadata?.bundle_id === "string"
              ? i.metadata.bundle_id
              : null;
          const bundleLabel =
            typeof i.metadata?.bundle_label === "string"
              ? i.metadata.bundle_label
              : null;
          const title =
            variant?.product?.title ?? variant?.title ?? i?.title ?? "Product";
          const unitPrice = i.unit_price ?? 0;
          const qty = i.quantity ?? 1;
          const itemTotalCents = medusaAmountToCents(
            i.total ?? unitPrice * qty
          );

          return (
            <CardShell key={i.id} variant="default" padding="md">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-[var(--foreground)]">{title}</p>
                  {variant?.title && variant.title !== "Default" && (
                    <p className="text-sm text-[var(--muted)]">{variant.title}</p>
                  )}
                  {bundleId && (
                    <p className="mt-1 text-xs font-medium text-[var(--accent)]">
                      Bundel: {bundleLabel ?? bundleId}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <CartItemQuantityControl
                    itemId={i.id as string}
                    quantity={qty}
                    disabled={!!bundleId}
                  />
                  <PriceDisplay amount={itemTotalCents} currencyCode={currencyCode} size="md" />
                  <RemoveFromCartButton itemId={i.id as string} />
                </div>
              </div>
            </CardShell>
          );
        })}
      </div>

      <CardShell variant="default" padding="lg" className="mt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xl font-bold text-[var(--foreground)]">
            Subtotaal:{" "}
            <PriceDisplay amount={subtotalCents} currencyCode={currencyCode} size="lg" />
          </p>
          <p className="text-sm text-[var(--muted)]">
            Verzendkosten worden berekend bij het afrekenen.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <Button asChild>
            <Link href="/checkout">Afrekenen</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/materials">Verder winkelen</Link>
          </Button>
        </div>
      </CardShell>
    </PageLayout>
  );
}
