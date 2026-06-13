"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CardShell } from "@/components/ui/card-shell";

type MerchantUpsellBannerProps = {
  hasMerchantRole: boolean;
  hasSellerLink: boolean;
  creatorHasSupplierRole: boolean;
};

export function MerchantUpsellBanner({
  hasMerchantRole,
  hasSellerLink,
  creatorHasSupplierRole,
}: MerchantUpsellBannerProps) {
  const pathname = usePathname();

  if (hasSellerLink) {
    if (pathname === "/dashboard/verkoper") {
      return null;
    }

    return (
      <CardShell variant="featured" padding="md" className="mb-6 border-emerald-300 bg-emerald-50">
        <p className="text-sm text-emerald-900">
          Beheer verzending, voorraad en uitbetalingen in het verkopersportaal.{" "}
          <Link href="/dashboard/verkoper" className="underline font-medium">
            Open verkopersportaal
          </Link>
        </p>
      </CardShell>
    );
  }

  if (hasMerchantRole) return null;

  const isCreatorPage = pathname === "/dashboard/creator";
  const isProductsPage = pathname === "/dashboard/products";
  const isMaterialsPage = pathname.startsWith("/dashboard/materials");

  const shouldShow =
    creatorHasSupplierRole || isProductsPage || isMaterialsPage;

  if (!shouldShow || isCreatorPage) return null;

  return (
    <CardShell variant="featured" padding="md" className="mb-6 border-violet-300 bg-violet-50">
      <p className="text-sm text-violet-900">
        Verkoop je garen, stof of hobbybenodigdheden?{" "}
        <Link
          href={`/register/merchant?next=${encodeURIComponent("/dashboard/materials")}`}
          className="underline font-medium"
        >
          Activeer je winkel
        </Link>{" "}
        om producten te importeren en te verkopen.
      </p>
    </CardShell>
  );
}
