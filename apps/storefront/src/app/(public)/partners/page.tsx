import { buildPageMetadata } from "@/lib/seo";
import { PartnersLanding } from "@/components/marketing/partners-landing";
import { PARTNERS_PAGE } from "@/lib/marketing/partners-page";

export const metadata = buildPageMetadata({
  title: PARTNERS_PAGE.metaTitle,
  description: PARTNERS_PAGE.metaDescription,
  path: "/partners",
});

export default function PartnersPage() {
  return <PartnersLanding />;
}
