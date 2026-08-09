import { buildPageMetadata } from "@/lib/seo";
import { WorkshopHostLanding } from "@/components/marketing/workshop-host-landing";
import { WORKSHOP_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: WORKSHOP_PAGE.metaTitle,
  description: WORKSHOP_PAGE.metaDescription,
  path: "/voor-workshopgevers",
});

export default function VoorWorkshopgeversPage() {
  return <WorkshopHostLanding />;
}
