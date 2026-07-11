import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ContentHubBrowser, type ContentHubItem } from "@/components/content/ContentHubBrowser";
import { EmptyState } from "@/components/ui/empty-state";
import { listPublishedContentArticles } from "@/lib/platform/queries/articles";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Artikelen, gidsen en tutorials | Hobbysalon",
  description: "Praktische gidsen en tutorials voor creatieve hobby's. Ontdek ideeën, leer technieken en vind materialen, workshops en makers.",
  path: "/artikelen",
});

export default async function ArticlesHubPage() {
  const [articles, domains] = await Promise.all([listPublishedContentArticles(96), listActiveDomains()]);
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));
  const items: ContentHubItem[] = articles.map((article) => {
    const domain = article.domain_id ? domainById.get(article.domain_id) : null;
    return { article, domainName: domain?.name ?? null, domainSlug: domain?.slug ?? null };
  });

  return <>
    <div className="border-b border-[var(--border)] bg-[var(--section-highlight)]">
      <Container size="wide" className="py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]"><ol className="flex flex-wrap gap-2"><li><Link href="/" className="hover:text-[var(--foreground)]">Home</Link></li><li aria-hidden>/</li><li className="text-[var(--foreground)]">Artikelen</li></ol></nav>
        <div className="mt-7 grid items-end gap-7 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.42fr)]">
          <div><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]"><BookOpen size={24} aria-hidden /></span><h1 className="mt-5 max-w-3xl font-[family-name:var(--font-heading)] text-4xl font-bold leading-tight text-[var(--foreground)] sm:text-5xl">Artikelen die je verder helpen maken</h1><p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">Lees een techniek, ontdek een idee en vind daarna materialen, workshops en makers die erbij passen.</p></div>
          <Link href="/patronen" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-[0_10px_24px_rgb(38_58_47_/_0.06)] transition-transform hover:-translate-y-0.5 active:translate-y-px"><p className="text-sm font-semibold text-[var(--accent)]">Lievere meteen maken?</p><p className="mt-2 text-xl font-semibold">Bekijk alle patronen</p><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Kies een project met een duidelijke materialenlijst en volgende stap.</p></Link>
        </div>
      </Container>
    </div>
    <Container size="wide" className="pt-8 sm:pt-10">{items.length === 0 ? <EmptyState title="Nog geen artikelen toegevoegd" description="Nieuwe gidsen en tutorials verschijnen hier binnenkort." action={{ label: "Naar home", href: "/" }} /> : <ContentHubBrowser items={items} kind="articles" />}</Container>
  </>;
}
