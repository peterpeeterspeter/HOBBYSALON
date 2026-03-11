import { cookies } from "next/headers";
import Link from "next/link";
import { CART_COOKIE_NAME, getCart } from "@/lib/commerce/medusa/cart";
import { RemoveFromCartButton } from "@/components/cart/RemoveFromCartButton";

export const dynamic = "force-dynamic";

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export default async function CartPage() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!cartId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">
          Winkelwagen
        </h1>
        <p className="text-[var(--muted)] mb-6">
          Je winkelwagen is leeg. Ontdek onze producten en voeg iets toe.
        </p>
        <Link
          href="/crochet"
          className="inline-flex rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] hover:opacity-90"
        >
          Verder winkelen
        </Link>
      </div>
    );
  }

  const cart = await getCart(cartId);

  if (!cart || !cart.items?.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">
          Winkelwagen
        </h1>
        <p className="text-[var(--muted)] mb-6">
          Je winkelwagen is leeg. Ontdek onze producten en voeg iets toe.
        </p>
        <Link
          href="/crochet"
          className="inline-flex rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] hover:opacity-90"
        >
          Verder winkelen
        </Link>
      </div>
    );
  }

  const currencyCode = (cart as { currency_code?: string }).currency_code ?? "eur";
  const subtotal =
    cart.items?.reduce((sum: number, item) => {
      const unitPrice = (item as { unit_price?: number }).unit_price ?? 0;
      const qty = (item as { quantity?: number }).quantity ?? 1;
      return sum + unitPrice * qty;
    }, 0) ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-6">
        Winkelwagen
      </h1>

      <div className="space-y-6">
        {(cart.items ?? []).map((item) => {
          const i = item as { id?: string; variant?: { id?: string; title?: string; product?: { title?: string } }; unit_price?: number; quantity?: number; total?: number; title?: string };
          const variant = i.variant as {
            id: string;
            title?: string;
            product?: { title?: string };
          };
          const title =
            variant?.product?.title ?? variant?.title ?? i?.title ?? "Product";
          const unitPrice = i.unit_price ?? 0;
          const qty = i.quantity ?? 1;
          const itemTotal = i.total ?? unitPrice * qty;

          return (
            <div
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex-1">
                <p className="font-medium text-[var(--foreground)]">{title}</p>
                {variant?.title && variant.title !== "Default" && (
                  <p className="text-sm text-[var(--muted)]">{variant.title}</p>
                )}
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Aantal: {qty}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-semibold text-[var(--foreground)]">
                  {formatPrice(itemTotal, currencyCode)}
                </p>
                <RemoveFromCartButton itemId={i.id as string} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xl font-bold text-[var(--foreground)]">
          Subtotaal: {formatPrice(subtotal, currencyCode)}
        </p>
        <p className="text-sm text-[var(--muted)]">
          Verzendkosten worden berekend bij het afrekenen.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href="/checkout"
          className="inline-flex rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] hover:opacity-90"
        >
          Afrekenen
        </Link>
        <Link
          href="/crochet"
          className="inline-flex rounded-lg border border-[var(--border)] px-6 py-3 font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
        >
          Verder winkelen
        </Link>
      </div>
    </div>
  );
}
