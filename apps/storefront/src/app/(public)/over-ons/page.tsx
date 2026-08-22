import { buildPageMetadata } from "@/lib/seo";
import { AboutLanding } from "@/components/marketing/about-landing";
import { ABOUT_PAGE } from "@/lib/marketing/about-page";

export const metadata = buildPageMetadata({
  title: ABOUT_PAGE.metaTitle,
  description: ABOUT_PAGE.metaDescription,
  path: "/over-ons",
});

export default function OverOnsPage() {
  return <AboutLanding />;
}
