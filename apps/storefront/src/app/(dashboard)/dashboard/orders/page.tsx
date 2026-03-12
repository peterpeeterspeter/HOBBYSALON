import { getAuthUser } from "@/lib/auth/session";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { listCreatorOrders } from "@/lib/commerce/medusa/creator-orders";
import {
  cancelCreatorOrderAction,
  completeCreatorOrderAction,
} from "@/app/actions/dashboard";
import { CardShell } from "@/components/ui/card-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/domain/price-display";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function DashboardOrdersPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { success, error } = await searchParams;

  if (!user) {
    return null;
  }

  const context = await getUserRegistrationContext(user.id);
  const creatorSeller = context.sellerLinks.find(
    (link) => link.sellerType === "creator"
  );

  const orderResponse = creatorSeller
    ? await listCreatorOrders({
        sellerId: creatorSeller.sellerId,
        limit: 50,
        offset: 0,
      })
    : null;
  const orders = orderResponse?.orders ?? [];

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Bestellingen</h1>
      <p className="text-[var(--muted)]">
        Beheer je marketplace-bestellingen en werk orderstatussen bij.
      </p>

      {success && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!creatorSeller ? (
        <EmptyState
          title="Geen creator seller-link"
          description="Registreer eerst je creator seller-profiel om bestellingen te beheren."
        />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Nog geen bestellingen"
          description="Zodra je eerste verkoop binnenkomt, zie je die hier."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <CardShell key={order.id} variant="default" padding="md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    Order #{order.display_id ?? order.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {new Date(order.created_at).toLocaleString("nl-BE")}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {order.email ?? "Onbekende koper"}
                  </p>
                </div>
                <div className="text-right">
                  <PriceDisplay
                    amount={order.total ?? 0}
                    currencyCode={order.currency_code ?? "EUR"}
                    size="md"
                  />
                  <p className="text-xs text-[var(--muted)]">
                    status: {order.status ?? "-"} · betaling: {order.payment_status ?? "-"} ·
                    levering: {order.fulfillment_status ?? "-"}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Items ({order.items?.length ?? 0})
                </p>
                <ul className="mt-1 space-y-1 text-sm text-[var(--muted)]">
                  {(order.items ?? []).slice(0, 5).map((item) => (
                    <li key={item.id}>
                      {item.title ?? "Item"} × {item.quantity ?? 0}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={completeCreatorOrderAction}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Markeer voltooid
                  </Button>
                </form>
                <form action={cancelCreatorOrderAction}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <Button type="submit" variant="danger" size="sm">
                    Annuleer order
                  </Button>
                </form>
              </div>
            </CardShell>
          ))}
        </div>
      )}
    </section>
  );
}
