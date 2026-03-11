import Link from "next/link";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <TrackOnMount
        event="checkout_completed"
        payload={{ order_id: orderId ?? null }}
      />
      <h1 className="text-3xl font-bold text-[var(--foreground)] mb-4">
        Bedankt voor je bestelling!
      </h1>
      <p className="text-[var(--muted)] mb-8">
        Je bestelling is succesvol geplaatst. Je ontvangt binnenkort een
        bevestiging per e-mail.
        {orderId && (
          <span className="block mt-2 font-mono text-sm">
            Ordernummer: {orderId}
          </span>
        )}
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
