import Link from "next/link";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function parseBundleIds(value?: string): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseNonNegativeNumber(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    order?: string;
    bundle_id?: string;
    bundle_count?: string;
    bundle_value?: string;
    bundle_ids?: string;
  }>;
}) {
  const viewer = await getAuthUser();
  const params = await searchParams;
  const orderId = params.order;
  const bundleIds = parseBundleIds(params.bundle_ids);
  const bundleId = params.bundle_id?.trim() || bundleIds[0] || null;
  const bundleCount = parseNonNegativeNumber(params.bundle_count) ?? bundleIds.length;
  const bundleValue = parseNonNegativeNumber(params.bundle_value) ?? 0;
  const hasBundleContext = bundleCount > 0;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <TrackOnMount
        event="checkout_completed"
        payload={{
          order_id: orderId ?? null,
          bundle_id: bundleId,
          bundle_count: bundleCount,
          bundle_value: bundleValue,
          bundle_ids: bundleIds,
          user_id: viewer?.id ?? null,
        }}
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
        {hasBundleContext && (
          <span className="mt-2 block text-sm">
            Bundelcontext bevestigd: {bundleCount} bundel
            {bundleCount === 1 ? "" : "s"} verwerkt in je bestelling.
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
