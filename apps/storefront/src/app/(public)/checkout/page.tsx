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
import { TrackOnMount } from "@/components/analytics/TrackOnMount";

export const dynamic = "force-dynamic";

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

type CheckoutPageCartItem = {
  id?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  metadata?: Record<string, unknown>;
  variant?: { product?: { title?: string }; title?: string };
};

type BundleGroup = {
  bundleId: string;
  bundleLabel: string;
  itemCount: number;
  total: number;
};

function getBundleGroups(items: CheckoutPageCartItem[] | undefined): BundleGroup[] {
  const groups = new Map<string, BundleGroup>();

  for (const item of items ?? []) {
    const bundleId =
      typeof item.metadata?.bundle_id === "string"
        ? item.metadata.bundle_id
        : null;
    if (!bundleId) continue;

    const bundleLabel =
      typeof item.metadata?.bundle_label === "string" &&
      item.metadata.bundle_label.trim().length > 0
        ? item.metadata.bundle_label
        : bundleId;
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
    const itemTotal = item.total ?? (item.unit_price ?? 0) * quantity;
    const existing = groups.get(bundleId);

    if (existing) {
      existing.itemCount += quantity;
      existing.total += itemTotal;
      continue;
    }

    groups.set(bundleId, {
      bundleId,
      bundleLabel,
      itemCount: quantity,
      total: itemTotal,
    });
  }

  return [...groups.values()];
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
    items?: CheckoutPageCartItem[];
  };

  const currencyCode = c.currency_code ?? "eur";
  const hasAddress = !!c.email && !!c.shipping_address?.address_1;
  const shippingOptions = hasAddress ? await getShippingOptions(cartId) : null;
  const selectedShippingId = c.shipping_methods?.[0]?.shipping_option_id;
  const hasShipping = !!selectedShippingId;

  const subtotal =
    cart.items?.reduce((sum: number, item) => {
      const unitPrice = (item as { unit_price?: number }).unit_price ?? 0;
      const qty = (item as { quantity?: number }).quantity ?? 1;
      return sum + unitPrice * qty;
    }, 0) ?? 0;

  const shippingTotal = (cart as { shipping_total?: number }).shipping_total ?? 0;
  const total = (cart as { total?: number }).total ?? subtotal + shippingTotal;
  const itemCount =
    cart.items?.reduce((sum: number, item) => {
      const qty = (item as { quantity?: number }).quantity ?? 1;
      return sum + qty;
    }, 0) ?? 0;
  const bundleGroups = getBundleGroups(c.items);
  const bundleIds = bundleGroups.map((group) => group.bundleId);
  const bundleValue = bundleGroups.reduce((sum, group) => sum + group.total, 0);
  const primaryBundleId = bundleIds[0] ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <TrackOnMount
        event="checkout_started"
        payload={{
          currency_code: currencyCode,
          total_amount: total,
          item_count: itemCount,
          bundle_id: primaryBundleId,
          bundle_count: bundleGroups.length,
          bundle_value: bundleValue,
          bundle_ids: bundleIds,
        }}
      />
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-8">
        Afrekenen
      </h1>

      <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="font-medium text-[var(--foreground)] mb-2">
          Overzicht
        </p>
        {(cart.items ?? []).map((item) => {
          const i = item as CheckoutPageCartItem;
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
        {bundleGroups.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Bundels in deze checkout
            </p>
            {bundleGroups.map((group) => (
              <div
                key={group.bundleId}
                className="rounded-md border border-[var(--border)] p-2"
              >
                <div className="flex justify-between text-sm text-[var(--foreground)]">
                  <span>{group.bundleLabel}</span>
                  <span>{formatPrice(group.total, currencyCode)}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {group.itemCount} artikel{group.itemCount === 1 ? "" : "en"} ·
                  ID: {group.bundleId}
                </p>
              </div>
            ))}
          </div>
        )}
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
