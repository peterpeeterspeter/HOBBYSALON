import Link from "next/link";
import {
  ListingHeroBand,
} from "@/components/shared/ListingHeroBand";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { Container } from "@/components/ui/container";
import { ContentHubBrowser, type ContentHubItem } from "@/components/content/ContentHubBrowser";
import { EmptyState } from "@/components/ui/empty-state";
import { buildContentHubItems } from "@/lib/content/build-content-hub-items";
import {
  listArticleDomainLinks,
  listPublishedContentArticles,
} from "@/lib/platform/queries/articles";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildPageMetadata({
  title: "Inspiratie: artikelen en tutorials | Hobbysalon",
  description:
    "Recente tutorials, technieken en creatieve ideeën om thuis aan de slag te gaan. Filter op hobby, niveau en soort artikel.",
  path: "/artikelen",
});

export default async function ArticlesHubPage() {
  const [articles, domains] = await Promise.all([
    listPublishedContentArticles(96),
    listActiveDomains(),
  ]);
  const links = await listArticleDomainLinks(articles.map((article) => article.id));
  const items: ContentHubItem[] = buildContentHubItems(articles, domains, links);

  return (
    <>
      <ListingHeroBand
        title="Inspiratie om zelf aan de slag te gaan"
        lead="Tutorials, technieken en creatieve ideeën voor thuis. Recente inspiratie."
        imageSrc={LANDING_IMAGES.hero}
        breadcrumb={
          <nav aria-label="Breadcrumb" className="text-sm text-white/75">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-white">Inspiratie</li>
            </ol>
          </nav>
        }
        footer={
          <Link
            href="/patronen"
            className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-white/15 px-4 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 active:translate-y-px"
          >
            Bekijk patronen
          </Link>
        }
      />

      <Container size="wide" className="pt-8 sm:pt-10">
        {items.length === 0 ? (
          <EmptyState
            title="Nog geen artikelen toegevoegd"
            description="Nieuwe gidsen en tutorials verschijnen hier binnenkort."
            action={{ label: "Naar home", href: "/" }}
          />
        ) : (
          <ContentHubBrowser items={items} kind="articles" />
        )}
      </Container>
    </>
  );
}
