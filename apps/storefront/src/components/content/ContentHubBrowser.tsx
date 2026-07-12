"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { ArticleCard } from "@/components/cards";
import { DifficultyBadge } from "@/components/content/DifficultyBadge";
import { filterContentHubItems } from "@/lib/content/content-hub";
import { DIFFICULTY_LEVELS, getDifficultyMeta } from "@/lib/content/difficulty";
import type { Article } from "@/types/platform";

export type ContentHubItem = {
  article: Article;
  domainName: string | null;
  domainSlug: string | null;
};

type Props = {
  items: ContentHubItem[];
  kind: "articles" | "patterns";
};

const TYPE_LABELS: Record<string, string> = {
  tutorial: "Tutorials",
  guide: "Gidsen",
  inspiration: "Inspiratie",
  interview: "Interviews",
  news: "Nieuws",
  pattern: "Patronen",
};

function titleForType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function ContentHubBrowser({ items, kind }: Props) {
  const [type, setType] = useState("all");
  const [domain, setDomain] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [search, setSearch] = useState("");
  const filterItems = items.map((item) => ({
    ...item,
    id: item.article.id,
    title: item.article.title,
    articleType: item.article.article_type,
    difficultyLevel: item.article.difficulty_level,
  }));
  const filtered = useMemo(
    () => filterContentHubItems(filterItems, { type, domain, difficulty, search }),
    [difficulty, domain, filterItems, search, type]
  );
  const types = [...new Set(items.map((item) => item.article.article_type))];
  const domains = [...new Map(items.filter((item) => item.domainSlug && item.domainName).map((item) => [item.domainSlug!, item.domainName!])).entries()];
  const featured = filtered[0] ?? null;
  const rest = filtered.slice(1);
  const hasFilters = type !== "all" || domain !== "all" || difficulty !== "all" || search.trim().length > 0;
  const copy = kind === "patterns"
    ? { featured: "Uitgelicht patroon", results: "Meer patronen om te maken", empty: "Geen patronen gevonden met deze filters." }
    : { featured: "Uitgelicht om te lezen", results: "Meer om te ontdekken", empty: "Geen artikelen gevonden met deze filters." };

  return <div className="pb-14">
    {featured && <section className="mb-10">
      <p className="mb-3 text-sm font-semibold text-[var(--accent)]">{copy.featured}</p>
      <Link href={`/artikel/${featured.article.slug}`} className="group grid overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_14px_34px_rgb(38_58_47_/_0.08)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 md:grid-cols-[1.15fr_0.85fr] motion-reduce:hover:transform-none">
        <AspectImage ratio="video" src={featured.article.featured_image_url} alt={featured.article.title} fallbackImage="placeholderArticle" className="h-full min-h-56 rounded-none md:min-h-80" />
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <div className="flex flex-wrap gap-2"><Badge variant="domain">{titleForType(featured.article.article_type)}</Badge>{featured.domainName && <Badge variant="domain">{featured.domainName}</Badge>}<DifficultyBadge difficulty={featured.article.difficulty_level} /></div>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl">{featured.article.title}</h2>
          {featured.article.excerpt && <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{featured.article.excerpt}</p>}
          <span className="mt-5 text-sm font-semibold text-[var(--accent)]">Lees verder</span>
        </div>
      </Link>
    </section>}

    <section aria-labelledby="filters-title" className="rounded-2xl border border-[var(--border)] bg-[var(--section-highlight)]/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="filters-title" className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]"><SlidersHorizontal size={18} aria-hidden /> Vind wat bij je past</h2>
        <span className="text-sm text-[var(--muted)]">{filtered.length} {filtered.length === 1 ? "resultaat" : "resultaten"}</span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Zoek op onderwerp</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} aria-hidden /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bijvoorbeeld haken, sieraden of kaarten" className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 pl-10 pr-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35" /></span></label>
        {hasFilters && <button type="button" onClick={() => { setType("all"); setDomain("all"); setDifficulty("all"); setSearch(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] active:translate-y-px"><X size={16} aria-hidden /> Wis filters</button>}
      </div>
      {kind === "articles" && <div className="mt-4"><p className="text-sm font-medium text-[var(--foreground)]">Soort artikel</p><div className="mt-2 flex flex-wrap gap-2"><FilterButton active={type === "all"} onClick={() => setType("all")}>Alles</FilterButton>{types.map((value) => <FilterButton key={value} active={type === value} onClick={() => setType(value)}>{titleForType(value)}</FilterButton>)}</div></div>}
      {domains.length > 0 && <div className="mt-4"><p className="text-sm font-medium text-[var(--foreground)]">Hobbycategorie</p><div className="mt-2 flex flex-wrap gap-2"><FilterButton active={domain === "all"} onClick={() => setDomain("all")}>Alle hobby&apos;s</FilterButton>{domains.map(([slug, name]) => <FilterButton key={slug} active={domain === slug} onClick={() => setDomain(slug)}>{name}</FilterButton>)}</div></div>}
      <div className="mt-4"><p className="text-sm font-medium text-[var(--foreground)]">Moeilijkheid</p><div className="mt-2 flex flex-wrap gap-2"><FilterButton active={difficulty === "all"} onClick={() => setDifficulty("all")}>Alle niveaus</FilterButton>{DIFFICULTY_LEVELS.map((level) => <FilterButton key={level} active={difficulty === level} onClick={() => setDifficulty(level)}>{getDifficultyMeta(level)!.label}</FilterButton>)}</div></div>
    </section>

    <section className="mt-10" aria-live="polite"><h2 className="text-2xl font-semibold text-[var(--foreground)]">{copy.results}</h2>{rest.length > 0 ? <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{rest.map((item) => <ArticleCard key={item.article.id} article={item.article} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-5 py-10 text-center"><p className="text-lg font-semibold text-[var(--foreground)]">{copy.empty}</p><p className="mt-2 text-[var(--muted)]">Probeer een andere zoekterm of wis je filters.</p></div>}</section>
  </div>;
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors active:translate-y-px ${active ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"}`}>{children}</button>;
}
