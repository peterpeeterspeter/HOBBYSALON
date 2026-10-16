import { buildPageMetadata } from "@/lib/seo";
import { AdverterenLanding } from "@/components/marketing/adverteren-landing";
import { ADVERTEREN_PAGE } from "@/lib/marketing/adverteren-page";

export const metadata = buildPageMetadata({
  title: ADVERTEREN_PAGE.metaTitle,
  description: ADVERTEREN_PAGE.metaDescription,
  path: "/adverteren",
});

export default function AdverterenPage() {
  return <AdverterenLanding />;
}
