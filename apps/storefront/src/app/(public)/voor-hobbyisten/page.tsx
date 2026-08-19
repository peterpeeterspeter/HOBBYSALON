import { buildPageMetadata } from "@/lib/seo";
import { HobbyistLanding } from "@/components/marketing/hobbyist-landing";
import { HOBBYIST_PAGE } from "@/lib/marketing/hobbyist-page";
import { getToolSummaries } from "@/lib/tools/registry";

export const metadata = buildPageMetadata({
  title: HOBBYIST_PAGE.metaTitle,
  description: HOBBYIST_PAGE.metaDescription,
  path: "/voor-hobbyisten",
});

export default function VoorHobbyistenPage() {
  const tools = getToolSummaries();
  return <HobbyistLanding tools={tools} />;
}
