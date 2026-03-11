import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCartForCheckout,
  getShippingOptions,
  CART_COOKIE_NAME,
} from "@/lib/commerce/medusa/cart";
import { CheckoutAddressForm } from "@/components/checkout/CheckoutAddressForm";
import { CheckoutShippingStep } from "@/components/checkout/CheckoutShippingStep";
import { CheckoutPaymentForm } from "@/components/checkout/CheckoutPaymentForm";

export const dynamic = "force-dynamic";

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

type PageProps = { searchParams: Promise<{ payment_error?: string }> };

export default async function CheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const paymentError = params.payment_error === "1";

  const cartId = (await cookies()).get(CART_COOKIE_NAME)?.value;

  if (!cartId) {
    redirect("/cart");
  }

  const cart = await getCartForCheckout(cartId);

  if (!cart || !cart.items?.length) {
    redirect("/cart");
  }

  const c = cart as {
    email?: string;
    shipping_address?: Record<string, unknown>;
    shipping_methods?: { shipping_option_id?: string }[];
    payment_collection?: { payment_sessions?: unknown[] };
    region_id?: string;
    currency_code?: string;
    items?: { variant?: { product?: { title?: string }; title?: string }; quantity?: number; unit_price?: number; total?: number }[];
  };

  const currencyCode = c.currency_code ?? "eur";
  const hasAddress = !!c.email && !!c.shipping_address?.address_1;
  const shippingOptions = hasAddress ? await getShippingOptions(cartId) : null;
  const selectedShippingId = c.shipping_methods?.[0]?.shipping_option_id;
  const hasShipping = !!selectedShippingId;
  const hasPaymentSession = (c.payment_collection?.payment_sessions?.length ?? 0) > 0;

  const subtotal =
    cart.items?.reduce((sum: number, item) => {
      const unitPrice = (item as { unit_price?: number }).unit_price ?? 0;
      const qty = (item as { quantity?: number }).quantity ?? 1;
      return sum + unitPrice * qty;
    }, 0) ?? 0;

  const shippingTotal = (cart as { shipping_total?: number }).shipping_total ?? 0;
  const total = (cart as { total?: number }).total ?? subtotal + shippingTotal;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-8">
        Afrekenen
      </h1>

      <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="font-medium text-[var(--foreground)] mb-2">
          Overzicht
        </p>
        {(cart.items ?? []).map((item) => {
          const i = item as { id?: string; variant?: { product?: { title?: string }; title?: string }; quantity?: number; total?: number };
          const variant = i.variant;
          const title =
            variant?.product?.title ?? variant?.title ?? "Product";
          const qty = i.quantity ?? 1;
          const itemTotal = i.total ?? 0;
          return (
            <div key={i.id} className="flex justify-between text-sm text-[var(--muted)]">
              <span>{title} × {qty}</span>
              <span>{formatPrice(itemTotal, currencyCode)}</span>
            </div>
          );
        })}
        <div className="mt-2 flex justify-between border-t border-[var(--border)] pt-2 font-medium text-[var(--foreground)]">
          <span>Subtotaal</span>
          <span>{formatPrice(subtotal, currencyCode)}</span>
        </div>
        {hasShipping && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Verzending</span>
            <span>{formatPrice(shippingTotal, currencyCode)}</span>
          </div>
        )}
        {hasShipping && (
          <div className="flex justify-between border-t border-[var(--border)] pt-2 text-lg font-bold text-[var(--foreground)]">
            <span>Totaal</span>
            <span>{formatPrice(total, currencyCode)}</span>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {!hasAddress && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
            <CheckoutAddressForm
              defaultEmail={c.email}
              defaultAddress={c.shipping_address as Record<string, string> | undefined}
            />
          </div>
        )}

        {hasAddress && !hasShipping && shippingOptions !== null && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
            <CheckoutShippingStep
              options={shippingOptions}
              currencyCode={currencyCode}
              selectedOptionId={selectedShippingId}
            />
          </div>
        )}

        {hasAddress && hasShipping && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
            {paymentError && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
                De betaling is mislukt. Probeer een andere kaart of betaalmethode. Voor testbetalingen gebruik 4242 4242 4242 4242.
              </div>
            )}
            <CheckoutPaymentForm total={total} currencyCode={currencyCode} />
          </div>
        )}

        {hasAddress && shippingOptions !== null && !hasShipping && shippingOptions.length === 0 && (
          <p className="text-[var(--muted)]">
            Geen verzendopties beschikbaar voor dit adres.
          </p>
        )}
      </div>

      <div className="mt-8">
        <Link
          href="/cart"
          className="text-[var(--accent)] underline hover:no-underline"
        >
          ← Terug naar winkelwagen
        </Link>
      </div>
    </div>
  );
}
