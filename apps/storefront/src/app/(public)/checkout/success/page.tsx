import Link from "next/link";
import { getAuthUser } from "@/lib/auth/session";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { verifyCheckoutSuccessOrder } from "@/lib/commerce/medusa/orders";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    order?: string;
  }>;
}) {
  const viewer = await getAuthUser();
  const params = await searchParams;
  const orderId = params.order;
  const { verified } = await verifyCheckoutSuccessOrder(orderId);

  if (!verified) {
    return (
      <PageLayout
        title="Bestelling niet gevonden"
        description="We konden deze bestelling niet bevestigen. Controleer je e-mail of bekijk je bestellingen na het aanmelden."
        size="narrow"
        className="text-center py-16"
      >
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={viewer ? "/account/orders" : "/login?next=/account/orders"}>
              {viewer ? "Mijn bestellingen" : "Aanmelden"}
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/materials">Verder winkelen</Link>
          </Button>
        </div>
      </PageLayout>
    );
  }

  const descriptionParts = [
    "Je bestelling is succesvol geplaatst. Je ontvangt binnenkort een bevestiging per e-mail.",
    orderId && `Ordernummer: ${orderId}`,
  ].filter(Boolean) as string[];

  return (
    <PageLayout
      title="Bedankt voor je bestelling!"
      description={descriptionParts.join(" ")}
      size="narrow"
      className="text-center py-16"
    >
      <div className="flex flex-wrap justify-center gap-3">
        {viewer && orderId ? (
          <Button asChild>
            <Link href={`/account/orders/${orderId}`}>Bekijk bestelling</Link>
          </Button>
        ) : null}
        <Button asChild variant={viewer && orderId ? "secondary" : "primary"}>
          <Link href="/materials">Verder winkelen</Link>
        </Button>
      </div>
    </PageLayout>
  );
}
