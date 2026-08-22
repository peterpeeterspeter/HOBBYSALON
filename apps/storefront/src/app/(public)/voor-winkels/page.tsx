import { buildPageMetadata } from "@/lib/seo";
import { SupplierLanding } from "@/components/marketing/supplier-landing";
import { SUPPLIER_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: SUPPLIER_PAGE.metaTitle,
  description: SUPPLIER_PAGE.metaDescription,
  path: "/voor-winkels",
});

export default function VoorWinkelsPage() {
  return <SupplierLanding />;
}
