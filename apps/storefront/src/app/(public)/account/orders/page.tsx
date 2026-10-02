import Link from "next/link";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { PriceDisplay } from "@/components/domain/price-display";
import { getAuthUser } from "@/lib/auth/session";
import { listBuyerOrdersForAuthUser } from "@/lib/commerce/medusa/orders";

export const dynamic = "force-dynamic";

export default async function BuyerOrdersPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/account/orders");
  }

  const orders = await listBuyerOrdersForAuthUser();

  return (
    <PageLayout
      title="Mijn bestellingen"
      description="Overzicht van je aankopen bij Hobbysalon."
      size="narrow"
    >
      {orders.length === 0 ? (
        <CardShell variant="default" padding="lg">
          <p className="text-[var(--muted)]">Je hebt nog geen bestellingen.</p>
          <Link
            href="/materials"
            className="mt-4 inline-flex text-[var(--accent)] underline"
          >
            Bekijk materialen
          </Link>
        </CardShell>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <CardShell variant="default" padding="md">
                <Link
                  href={`/account/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">
                      Bestelling {order.display_id ?? order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {new Date(order.created_at).toLocaleDateString("nl-BE")} ·{" "}
                      {order.status}
                      {order.seller_order_count > 1
                        ? ` · ${order.seller_order_count} verkopers`
                        : ""}
                    </p>
                  </div>
                  <PriceDisplay
                    amount={order.total_cents}
                    currencyCode={order.currency_code}
                    size="sm"
                  />
                </Link>
              </CardShell>
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}
