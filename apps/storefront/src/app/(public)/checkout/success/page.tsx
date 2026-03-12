import Link from "next/link";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { getAuthUser } from "@/lib/auth/session";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";

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

  const descriptionParts = [
    "Je bestelling is succesvol geplaatst. Je ontvangt binnenkort een bevestiging per e-mail.",
    orderId && `Ordernummer: ${orderId}`,
    hasBundleContext && `Bundelcontext bevestigd: ${bundleCount} bundel${bundleCount === 1 ? "" : "s"} verwerkt in je bestelling.`,
  ].filter(Boolean) as string[];

  return (
    <PageLayout
      title="Bedankt voor je bestelling!"
      description={descriptionParts.join(" ")}
      size="narrow"
      className="text-center py-16"
    >
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
      <div className="flex justify-center">
        <Button asChild>
          <Link href="/crochet">Verder winkelen</Link>
        </Button>
      </div>
    </PageLayout>
  );
}
