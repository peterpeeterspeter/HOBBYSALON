import { buildPageMetadata } from "@/lib/seo";
import { ContentMakerLanding } from "@/components/marketing/content-maker-landing";
import { CONTENT_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: CONTENT_PAGE.metaTitle,
  description: CONTENT_PAGE.metaDescription,
  path: "/voor-contentmakers",
});

export default function VoorContentmakersPage() {
  return <ContentMakerLanding />;
}
