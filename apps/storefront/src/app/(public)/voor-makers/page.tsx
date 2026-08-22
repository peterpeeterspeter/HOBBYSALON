import { buildPageMetadata } from "@/lib/seo";
import { MakerLanding } from "@/components/marketing/maker-landing";
import { MAKERS_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: MAKERS_PAGE.metaTitle,
  description: MAKERS_PAGE.metaDescription,
  path: "/voor-makers",
});

export default function VoorMakersPage() {
  return <MakerLanding />;
}
