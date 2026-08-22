import { buildPageMetadata } from "@/lib/seo";
import { OrganizerLanding } from "@/components/marketing/organizer-landing";
import { ORGANIZER_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: ORGANIZER_PAGE.metaTitle,
  description: ORGANIZER_PAGE.metaDescription,
  path: "/voor-organisatoren",
});

export default function VoorOrganisatorenPage() {
  return <OrganizerLanding />;
}
