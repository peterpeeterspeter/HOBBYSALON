import Link from "next/link";
import type { Metadata } from "next";
import { ListingHeroBand } from "@/components/shared/ListingHeroBand";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { Container } from "@/components/ui/container";
import { ContentHubBrowser, type ContentHubItem } from "@/components/content/ContentHubBrowser";
import { EmptyState } from "@/components/ui/empty-state";
import { buildContentHubItems } from "@/lib/content/build-content-hub-items";
import {
  listArticleDomainLinks,
  listPublishedPatterns,
} from "@/lib/platform/queries/articles";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Patronen voor creatieve hobby's | Hobbysalon",
  description:
    "Ontdek patronen voor creatieve hobby's. Bekijk bijpassende materialen, hulpmiddelen, workshops en makers op Hobbysalon.",
  path: "/patronen",
});

export default async function PatternsHubPage() {
  const [patterns, domains] = await Promise.all([
    listPublishedPatterns(96),
    listActiveDomains(),
  ]);
  const links = await listArticleDomainLinks(patterns.map((article) => article.id));
  const items: ContentHubItem[] = buildContentHubItems(patterns, domains, links);

  return (
    <>
      <ListingHeroBand
        title="Kies een patroon en begin met maken"
        lead="Vind een project dat bij je past. We verbinden je patroon met materialen, tools, workshops en makers."
        imageSrc={LANDING_IMAGES.domainCrochet}
        breadcrumb={
          <nav aria-label="Breadcrumb" className="text-sm text-white/75">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-white">Patronen</li>
            </ol>
          </nav>
        }
        footer={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/gratis-haakpatronen"
              className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-white/15 px-4 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 active:translate-y-px"
            >
              Gratis haakpatronen
            </Link>
            <Link
              href="/artikelen"
              className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-4 text-[15px] font-semibold text-white/90 transition-colors hover:bg-white/10 active:translate-y-px"
            >
              Naar inspiratie
            </Link>
          </div>
        }
      />

      <Container size="wide" className="pt-8 sm:pt-10">
        {items.length === 0 ? (
          <EmptyState
            title="Nog geen patronen toegevoegd"
            description="Nieuwe patronen verschijnen hier binnenkort."
            action={{ label: "Naar home", href: "/" }}
          />
        ) : (
          <ContentHubBrowser items={items} kind="patterns" />
        )}
      </Container>
    </>
  );
}
