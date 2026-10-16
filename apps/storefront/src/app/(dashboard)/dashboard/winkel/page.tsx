import Link from "next/link";
import { ExternalLink, PackageCheck, Store } from "lucide-react";
import { getDashboardContext, formatDashboardDate } from "@/lib/dashboard/load";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { listCreatorOrders } from "@/lib/commerce/medusa/creator-orders";
import { createPlatformClient } from "@/lib/platform/client";
import { Button } from "@/components/ui/button";
import {
  DashboardNotice,
  DashboardPageHeader,
  EmptyBlock,
  FlashMessage,
} from "@/components/dashboard/ui";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const OPEN_FULFILLMENT = new Set(["not_fulfilled", "partially_fulfilled", null, ""]);

/**
 * "Winkel": a calm summary for webshop sellers. Daily commerce work
 * (shipping, stock, promotions, Stripe) happens in the verkopersportaal.
 */
export default async function ShopPage({ searchParams }: Props) {
  const { success, error } = await searchParams;
  const { creator, registrationContext, caps } = await getDashboardContext("/dashboard/winkel");
  requireDashboardCapability(caps.canViewVendorPortalNav);

  const sellerId =
    registrationContext.sellerLinks.find((link) => link.sellerType === "merchant")?.sellerId ??
    null;

  const [ordersResponse, productsResult] = await Promise.all([
    caps.canManageOrders && sellerId
      ? listCreatorOrders({ sellerId, limit: 20, offset: 0 }).catch(() => null)
      : Promise.resolve(null),
    creator
      ? createPlatformClient()
          .from("products")
          .select("id, slug, title, is_active")
          .eq("creator_id", creator.id)
          .not("medusa_product_id", "is", null)
          .order("updated_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const orders = (ordersResponse?.orders ?? []).filter((order) => order.status !== "canceled");
  const toShip = orders.filter((order) => OPEN_FULFILLMENT.has(order.fulfillment_status ?? null));
  const products = (productsResult.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    is_active: boolean;
  }>;

  if (!caps.canAccessVendorPortal) {
    return (
      <div className="max-w-3xl">
        <DashboardPageHeader title="Winkel" />
        <DashboardNotice title="Wacht op goedkeuring" tone="attention">
          We bekijken je aanvraag voor een winkel. Je krijgt een e-mail zodra je kan beginnen met
          verkopen.
        </DashboardNotice>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <DashboardPageHeader
        title="Winkel"
        lead="Verzenden, voorraad, kortingen en uitbetalingen regel je in het verkopersportaal."
        action={
          <Button asChild size="lg">
            <Link href="/dashboard/verkoper">
              <Store size={22} aria-hidden="true" />
              Open verkopersportaal
            </Link>
          </Button>
        }
      />
      <FlashMessage success={success} error={error} />

      <section className="mb-10" aria-labelledby="verzenden-titel">
        <h2 id="verzenden-titel" className="mb-4 text-2xl font-bold text-[var(--foreground)]">
          Te verzenden
        </h2>
        {!ordersResponse ? (
          <EmptyBlock title="Bestellingen niet beschikbaar">
            We konden je bestellingen nu niet ophalen. Bekijk ze in het verkopersportaal.
          </EmptyBlock>
        ) : toShip.length === 0 ? (
          <EmptyBlock title="Niets te verzenden">
            Nieuwe bestellingen verschijnen hier. Je krijgt ook een e-mail.
          </EmptyBlock>
        ) : (
          <ul className="grid gap-3">
            {toShip.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[var(--accent)]/40 bg-[var(--card)] p-5"
              >
                <div>
                  <p className="text-xl font-bold text-[var(--foreground)]">
                    Bestelling {order.display_id ? `#${order.display_id}` : ""}
                  </p>
                  <p className="text-lg text-[var(--muted)]">
                    {formatDashboardDate(order.created_at)}
                    {order.items?.length
                      ? `, ${order.items
                          .map((item) => `${item.quantity ?? 1}x ${item.title ?? "artikel"}`)
                          .join(", ")}`
                      : ""}
                  </p>
                </div>
                <PackageCheck size={28} aria-hidden="true" className="text-[var(--accent-hover)]" />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-lg">
          <Link
            href="/dashboard/orders"
            className="font-semibold text-[var(--accent-hover)] underline underline-offset-4"
          >
            Alle bestellingen bekijken
          </Link>
        </p>
      </section>

      {caps.canViewSoughtMaterials ? (
        <section className="mb-10" aria-labelledby="gezocht-titel">
          <h2 id="gezocht-titel" className="text-2xl font-bold text-[var(--foreground)]">
            Producten gezocht
          </h2>
          <p className="mt-2 text-lg text-[var(--muted)]">
            Materialen die hobbyisten zoeken en nog niet in de webshop vinden.
          </p>
          <Button asChild variant="secondary" size="lg" className="mt-4">
            <Link href="/dashboard/sought-materials">Bekijk wat gezocht wordt</Link>
          </Button>
        </section>
      ) : null}

      {products.length > 0 ? (
        <section aria-labelledby="producten-titel">
          <h2 id="producten-titel" className="mb-2 text-2xl font-bold text-[var(--foreground)]">
            Je producten
          </h2>
          <p className="mb-4 text-lg text-[var(--muted)]">
            Prijzen, voorraad en foto&apos;s pas je aan in het verkopersportaal.
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            {products.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <span className="text-lg font-semibold text-[var(--foreground)]">
                  {product.title}
                  {!product.is_active ? (
                    <span className="font-normal text-[var(--muted)]"> (niet zichtbaar)</span>
                  ) : null}
                </span>
                {product.is_active ? (
                  <Link
                    href={`/product/${product.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 text-lg font-semibold text-[var(--accent-hover)] underline underline-offset-4"
                  >
                    Bekijken
                    <ExternalLink size={18} aria-hidden="true" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
