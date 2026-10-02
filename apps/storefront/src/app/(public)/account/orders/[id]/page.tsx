import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { PriceDisplay } from "@/components/domain/price-display";
import { OrderHelp } from "@/components/commerce/OrderHelp";
import { getAuthUser } from "@/lib/auth/session";
import { getBuyerOrderForAuthUser } from "@/lib/commerce/medusa/orders";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

function paymentStatusLabel(status?: string | null): string {
  switch (status) {
    case "captured":
      return "Betaald"
    case "refunded":
      return "Terugbetaald (Stripe)"
    case "partially_refunded":
      return "Gedeeltelijk terugbetaald (Stripe)"
    case "canceled":
      return "Geannuleerd"
    case "not_paid":
    case "awaiting":
      return "Nog niet betaald"
    default:
      return status ?? "—"
  }
}

export default async function BuyerOrderDetailPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) {
    const { id } = await params;
    redirect(`/login?next=${encodeURIComponent(`/account/orders/${id}`)}`);
  }

  const { id } = await params;
  const order = await getBuyerOrderForAuthUser(id);
  if (!order) notFound();

  return (
    <PageLayout
      title={`Bestelling ${order.display_id ?? order.id.slice(0, 8)}`}
      description={`Geplaatst op ${new Date(order.created_at).toLocaleDateString("nl-BE")}`}
      size="narrow"
    >
      <p className="mb-4 text-sm text-[var(--muted)]">
        Status: <span className="font-medium text-[var(--foreground)]">{order.status}</span>
      </p>

      <div className="space-y-4">
        {order.orders.map((sellerOrder, index) => (
          <CardShell key={sellerOrder.id} variant="default" padding="lg">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Deelbestelling {index + 1}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Betaling: {paymentStatusLabel(sellerOrder.payment_status)} · Levering:{" "}
              {sellerOrder.fulfillment_status ?? "—"}
            </p>
            <ul className="mt-4 space-y-2">
              {sellerOrder.items.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between gap-3 text-sm text-[var(--foreground)]"
                >
                  <span>
                    {item.title} × {item.quantity}
                  </span>
                  <PriceDisplay
                    amount={item.unit_price_cents * item.quantity}
                    currencyCode={sellerOrder.currency_code}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3 font-semibold">
              <span>Subtotaal</span>
              <PriceDisplay
                amount={sellerOrder.total_cents}
                currencyCode={sellerOrder.currency_code}
                size="sm"
              />
            </div>
          </CardShell>
        ))}
      </div>

      <div className="mt-6 flex justify-between text-lg font-bold">
        <span>Totaal</span>
        <PriceDisplay
          amount={order.total_cents}
          currencyCode={order.currency_code}
          size="md"
        />
      </div>

      <OrderHelp orderSetId={order.id} />

      <Link
        href="/account/orders"
        className="mt-4 inline-flex text-[var(--accent)] underline"
      >
        ← Alle bestellingen
      </Link>
    </PageLayout>
  );
}
