"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { ArticleCard } from "@/components/cards";
import { DifficultyBadge } from "@/components/content/DifficultyBadge";
import { filterContentHubItems } from "@/lib/content/content-hub";
import {
  formatArticleDisplayTitle,
  getArticleTypeVisitorLabel,
  hasUsableArticleImage,
} from "@/lib/content/article-display";
import { DIFFICULTY_LEVELS, getDifficultyMeta, type DifficultyLevel } from "@/lib/content/difficulty";
import type { Article } from "@/types/platform";

export type ContentHubItem = {
  article: Article;
  domainNames: string[];
  domainSlugs: string[];
  domainName: string | null;
  domainSlug: string | null;
  searchText: string;
};

type Props = {
  items: ContentHubItem[];
  kind: "articles" | "patterns";
};

type FilterRow = ContentHubItem & {
  id: string;
  title: string;
  articleType: string;
  difficultyLevel: string | null;
};

function pickFeatured(filtered: FilterRow[]): {
  item: FilterRow | null;
  isEditorial: boolean;
  textOnly: boolean;
} {
  const withImage = (item: FilterRow) =>
    hasUsableArticleImage(item.article.featured_image_url);

  const featuredWithImage = filtered.find(
    (item) => item.article.is_featured && withImage(item)
  );
  if (featuredWithImage) {
    return { item: featuredWithImage, isEditorial: true, textOnly: false };
  }

  const anyWithImage = filtered.find(withImage);
  if (anyWithImage) {
    return {
      item: anyWithImage,
      isEditorial: anyWithImage.article.is_featured,
      textOnly: false,
    };
  }

  const featuredAny = filtered.find((item) => item.article.is_featured);
  if (featuredAny) {
    return { item: featuredAny, isEditorial: true, textOnly: true };
  }

  if (filtered[0]) {
    return { item: filtered[0], isEditorial: false, textOnly: true };
  }

  return { item: null, isEditorial: false, textOnly: false };
}

export function ContentHubBrowser({ items, kind }: Props) {
  const [type, setType] = useState("all");
  const [domain, setDomain] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [search, setSearch] = useState("");

  const filterItems = useMemo<FilterRow[]>(
    () =>
      items.map((item) => ({
        ...item,
        id: item.article.id,
        title: item.article.title,
        articleType: item.article.article_type,
        difficultyLevel: item.article.difficulty_level,
        domainSlugs:
          item.domainSlugs.length > 0
            ? item.domainSlugs
            : item.domainSlug
              ? [item.domainSlug]
              : [],
        searchText:
          item.searchText ||
          [item.article.title, item.article.excerpt, ...(item.domainNames ?? []), getArticleTypeVisitorLabel(item.article.article_type)]
            .filter(Boolean)
            .join(" "),
      })),
    [items]
  );

  const filtered = useMemo(
    () => filterContentHubItems(filterItems, { type, domain, difficulty, search }),
    [difficulty, domain, filterItems, search, type]
  );

  const poolForDifficulty = useMemo(
    () =>
      filterContentHubItems(filterItems, {
        type,
        domain,
        difficulty: "all",
        search,
      }),
    [domain, filterItems, search, type]
  );

  const difficultyOptions = useMemo(() => {
    const present = new Set(
      poolForDifficulty
        .map((item) => item.difficultyLevel)
        .filter((level): level is string => !!level)
    );
    return DIFFICULTY_LEVELS.filter((level) => present.has(level));
  }, [poolForDifficulty]);

  useEffect(() => {
    if (
      difficulty !== "all" &&
      !difficultyOptions.includes(difficulty as DifficultyLevel)
    ) {
      setDifficulty("all");
    }
  }, [difficulty, difficultyOptions]);

  const types = useMemo(
    () => [...new Set(items.map((item) => item.article.article_type))],
    [items]
  );

  const domains = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const slugs =
        item.domainSlugs.length > 0
          ? item.domainSlugs
          : item.domainSlug
            ? [item.domainSlug]
            : [];
      const names =
        item.domainNames.length > 0
          ? item.domainNames
          : item.domainName
            ? [item.domainName]
            : [];
      for (let i = 0; i < slugs.length; i++) {
        const slug = slugs[i];
        const name = names[i] ?? slug;
        if (slug && !map.has(slug)) map.set(slug, name);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "nl-BE"));
  }, [items]);

  const featuredPick = useMemo(() => pickFeatured(filtered), [filtered]);
  const featured = featuredPick.item;
  const rest = useMemo(
    () =>
      featured
        ? filtered.filter((item) => item.article.id !== featured.article.id)
        : filtered,
    [featured, filtered]
  );

  const hasFilters =
    type !== "all" ||
    domain !== "all" ||
    difficulty !== "all" ||
    search.trim().length > 0;

  const showDifficultyRow = difficultyOptions.length > 1;

  const featuredHeading =
    kind === "patterns"
      ? featuredPick.isEditorial
        ? "Uitgelicht patroon"
        : "Nieuw om te maken"
      : featuredPick.isEditorial
        ? "Uitgelicht"
        : "Nieuw om te lezen";

  const copy =
    kind === "patterns"
      ? {
          results: "Meer patronen om te maken",
          empty: "Geen patronen gevonden met deze filters.",
          searchPlaceholder: "Bijvoorbeeld haken, amigurumi of baby",
        }
      : {
          results: "Meer om te ontdekken",
          empty: "Geen artikelen gevonden met deze filters.",
          searchPlaceholder: "Bijvoorbeeld haken, kaarten maken of keramiek",
        };

  return (
    <div className="pb-14">
      <section
        aria-labelledby="filters-title"
        className="rounded-2xl border border-[var(--border)] bg-[var(--section-highlight)]/55 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="filters-title"
            className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]"
          >
            <SlidersHorizontal size={18} aria-hidden /> Vind wat bij je past
          </h2>
          <span className="text-sm text-[var(--muted)]">
            {filtered.length}{" "}
            {filtered.length === 1 ? "resultaat" : "resultaten"}
          </span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              Zoek op onderwerp
            </span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                size={18}
                aria-hidden
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 pl-10 pr-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35"
              />
            </span>
          </label>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setType("all");
                setDomain("all");
                setDifficulty("all");
                setSearch("");
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] active:translate-y-px"
            >
              <X size={16} aria-hidden /> Wis filters
            </button>
          ) : null}
        </div>
        {kind === "articles" ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Soort artikel
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterButton active={type === "all"} onClick={() => setType("all")}>
                Alles
              </FilterButton>
              {types.map((value) => (
                <FilterButton
                  key={value}
                  active={type === value}
                  onClick={() => setType(value)}
                >
                  {getArticleTypeVisitorLabel(value)}
                </FilterButton>
              ))}
            </div>
          </div>
        ) : null}
        {domains.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Hobbycategorie
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterButton
                active={domain === "all"}
                onClick={() => setDomain("all")}
              >
                Alle hobby&apos;s
              </FilterButton>
              {domains.map(([slug, name]) => (
                <FilterButton
                  key={slug}
                  active={domain === slug}
                  onClick={() => setDomain(slug)}
                >
                  {name}
                </FilterButton>
              ))}
            </div>
          </div>
        ) : null}
        {showDifficultyRow ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Moeilijkheid
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterButton
                active={difficulty === "all"}
                onClick={() => setDifficulty("all")}
              >
                Alle niveaus
              </FilterButton>
              {difficultyOptions.map((level) => (
                <FilterButton
                  key={level}
                  active={difficulty === level}
                  onClick={() => setDifficulty(level)}
                >
                  {getDifficultyMeta(level)!.label}
                </FilterButton>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {featured ? (
        <section className="mt-10">
          <p className="mb-3 text-sm font-semibold text-[var(--accent)]">
            {featuredHeading}
          </p>
          {featuredPick.textOnly ? (
            <Link
              href={`/artikel/${featured.article.slug}`}
              className="group block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_10px_24px_rgb(38_58_47_/_0.06)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 sm:p-8 motion-reduce:hover:transform-none"
            >
              <div className="flex flex-wrap gap-2">
                <Badge variant="domain">
                  {getArticleTypeVisitorLabel(featured.article.article_type)}
                </Badge>
                {featured.domainName ? (
                  <Badge variant="domain">{featured.domainName}</Badge>
                ) : null}
                <DifficultyBadge difficulty={featured.article.difficulty_level} />
              </div>
              <h2 className="mt-4 font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl line-clamp-2">
                {formatArticleDisplayTitle(featured.article.title)}
              </h2>
              {featured.article.excerpt ? (
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)] line-clamp-3">
                  {featured.article.excerpt}
                </p>
              ) : null}
              {featured.article.reading_time_minutes ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {featured.article.reading_time_minutes} min lezen
                </p>
              ) : null}
              <span className="mt-5 inline-block text-sm font-semibold text-[var(--accent)]">
                Lees verder
              </span>
            </Link>
          ) : (
            <Link
              href={`/artikel/${featured.article.slug}`}
              className="group grid overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_14px_34px_rgb(38_58_47_/_0.08)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 md:grid-cols-[1.15fr_0.85fr] motion-reduce:hover:transform-none"
            >
              <AspectImage
                ratio="video"
                src={featured.article.featured_image_url}
                alt={formatArticleDisplayTitle(featured.article.title)}
                fallbackImage={null}
                className="h-full min-h-56 rounded-none md:min-h-80"
              />
              <div className="flex flex-col justify-center p-6 sm:p-8">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="domain">
                    {getArticleTypeVisitorLabel(featured.article.article_type)}
                  </Badge>
                  {featured.domainName ? (
                    <Badge variant="domain">{featured.domainName}</Badge>
                  ) : null}
                  <DifficultyBadge difficulty={featured.article.difficulty_level} />
                </div>
                <h2 className="mt-4 font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl line-clamp-2">
                  {formatArticleDisplayTitle(featured.article.title)}
                </h2>
                {featured.article.excerpt ? (
                  <p className="mt-3 text-base leading-relaxed text-[var(--muted)] line-clamp-3">
                    {featured.article.excerpt}
                  </p>
                ) : null}
                {featured.article.reading_time_minutes ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    {featured.article.reading_time_minutes} min lezen
                  </p>
                ) : null}
                <span className="mt-5 text-sm font-semibold text-[var(--accent)]">
                  Lees verder
                </span>
              </div>
            </Link>
          )}
        </section>
      ) : null}

      <section className="mt-10" aria-live="polite">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          {copy.results}
        </h2>
        {rest.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((item) => (
              <ArticleCard
                key={item.article.id}
                article={item.article}
                domainName={item.domainNames[0] ?? item.domainName}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-5 py-10 text-center">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {filtered.length === 0 ? copy.empty : "Geen verdere resultaten."}
            </p>
            <p className="mt-2 text-[var(--muted)]">
              {filtered.length === 0
                ? "Probeer een andere zoekterm of wis je filters."
                : "Pas je filters aan om meer te zien."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors active:translate-y-px ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
      }`}
    >
      {children}
    </button>
  );
}
