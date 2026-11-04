import Link from "next/link";
import {
  ListingHeroBand,
} from "@/components/shared/ListingHeroBand";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { Container } from "@/components/ui/container";
import { ArticleHub } from "@/components/content/ArticleHub";
import { HubAlsoFound } from "@/components/content/HubAlsoFound";
import { buildContentHubItems } from "@/lib/content/build-content-hub-items";
import { listArticleDomainLinks } from "@/lib/platform/queries/articles";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import {
  listArticleFacetCounts,
  listArticleHub,
  parseHubFilters,
} from "@/lib/platform/queries/article-hub";
import { buildPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildPageMetadata({
  title: "Inspiratie: artikelen en tutorials | Hobbysalon",
  description:
    "Recente tutorials, technieken en creatieve ideeën om thuis aan de slag te gaan. Filter op hobby, niveau en soort artikel.",
  path: "/artikelen",
});

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ArticlesHubPage({ searchParams }: Props) {
  const filters = parseHubFilters(await searchParams);
  const [{ articles, total }, facets, domains] = await Promise.all([
    listArticleHub(false, filters),
    listArticleFacetCounts(false, filters),
    listActiveDomains(),
  ]);
  const links = await listArticleDomainLinks(articles.map((article) => article.id));
  const items = buildContentHubItems(articles, domains, links);
  const results = items.map((item) => ({ article: item.article, domainName: item.domainName }));

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

      <Container size="wide" className="pt-12 sm:pt-16">
        <ArticleHub
          kind="articles"
          basePath="/artikelen"
          filters={filters}
          results={results}
          total={total}
          facets={facets}
          afterSearch={<HubAlsoFound query={filters.q} />}
        />
      </Container>
    </>
  );
}
