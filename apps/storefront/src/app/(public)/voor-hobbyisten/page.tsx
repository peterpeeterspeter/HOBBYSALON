import { buildPageMetadata } from "@/lib/seo";
import { HobbyistLanding } from "@/components/marketing/hobbyist-landing";
import { HOBBYIST_PAGE } from "@/lib/marketing/hobbyist-page";
import { getToolSummaries } from "@/lib/tools/registry";
import { getHobbyistPageData } from "@/lib/services/hobbyist-page";

export const metadata = buildPageMetadata({
  title: HOBBYIST_PAGE.metaTitle,
  description: HOBBYIST_PAGE.metaDescription,
  path: "/voor-hobbyisten",
});

/** Counts change slowly; refresh the page once an hour. */
export const revalidate = 3600;

export default async function VoorHobbyistenPage() {
  const tools = getToolSummaries();
  const data = await getHobbyistPageData();
  return <HobbyistLanding tools={tools} data={data} />;
}
