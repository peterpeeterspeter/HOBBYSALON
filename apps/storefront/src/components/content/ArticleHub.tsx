import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ArticleCard } from "@/components/cards";
import { getArticleTypeVisitorLabel } from "@/lib/content/article-display";
import { getDifficultyMeta } from "@/lib/content/difficulty";
import { facetLabel } from "@/lib/content/article-facets";
import {
  HOBBY_SCOPED_KEYS,
  HUB_PAGE_SIZE,
  HUB_PARAM_KEYS,
  type ArticleHubFilters,
  type FacetCount,
} from "@/lib/platform/queries/article-hub";
import type { Article } from "@/types/platform";

type HubParam = (typeof HUB_PARAM_KEYS)[number];

type Props = {
  kind: "articles" | "patterns";
  basePath: string;
  filters: ArticleHubFilters;
  results: { article: Article; domainName: string | null }[];
  total: number;
  facets: FacetCount[];
  /** Shown right under the search field, e.g. matching workshops and products. */
  afterSearch?: React.ReactNode;
};

type Group = {
  param: HubParam;
  title: string;
  options: { value: string; label: string; n?: number }[];
  /** Params to drop when this filter changes. */
  clears?: readonly HubParam[];
};

/** Facet values with fewer hits than this are noise, not a useful filter. */
const MIN_HITS = 3;
const VISIBLE_OPTIONS = 8;
/** Long tails (160+ techniques) overwhelm the panel; keep the top values. */
const MAX_OPTIONS = 24;

function hrefWith(
  basePath: string,
  filters: ArticleHubFilters,
  change: Partial<Record<HubParam | "pagina", string | undefined>>,
): string {
  const params = new URLSearchParams();
  for (const key of HUB_PARAM_KEYS) {
    const value = key in change ? change[key] : filters[key];
    if (value) params.set(key, value);
  }
  const page = "pagina" in change ? change.pagina : undefined;
  if (page && page !== "1") params.set("pagina", page);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function facetOptions(
  facets: FacetCount[],
  facet: string,
  label: (row: FacetCount) => string,
  minHits = MIN_HITS,
  bySort = false,
) {
  return facets
    .filter((row) => row.facet === facet && row.n >= minHits)
    .sort((a, b) =>
      bySort
        ? (a.sort ?? 999) - (b.sort ?? 999)
        : b.n - a.n || a.value.localeCompare(b.value, "nl-BE"),
    )
    .slice(0, MAX_OPTIONS)
    .map((row) => ({ value: row.value, label: label(row), n: row.n }));
}

/** Always visible: hobby, level and (for articles) kind. */
function basicGroups(kind: Props["kind"], facets: FacetCount[], filters: ArticleHubFilters): Group[] {
  const groups: Group[] = [
    {
      param: "domain",
      title: "Hobby",
      options: facetOptions(facets, "domain", (r) => r.label ?? r.value, 1, true),
      clears: HOBBY_SCOPED_KEYS,
    },
    {
      param: "niveau",
      title: "Niveau",
      options: facetOptions(facets, "niveau", (r) => getDifficultyMeta(r.value)?.label ?? r.value, 1),
    },
  ];
  if (kind === "articles") {
    groups.push(
      {
        param: "type",
        title: "Soort artikel",
        options: facetOptions(facets, "type", (r) => getArticleTypeVisitorLabel(r.value), 1),
      },
    );
  }
  return groups.filter((group) => group.options.length > 1 || Boolean(filters[group.param]));
}

/** Only after a hobby is chosen: values come from that hobby's articles. */
function hobbyGroups(facets: FacetCount[], filters: ArticleHubFilters): Group[] {
  return [
    { param: "techniek" as const, title: "Techniek", options: facetOptions(facets, "techniek", (r) => facetLabel(r.value)) },
    { param: "thema" as const, title: "Thema", options: facetOptions(facets, "thema", (r) => facetLabel(r.value)) },
    { param: "voor" as const, title: "Voor wie", options: facetOptions(facets, "voor", (r) => facetLabel(r.value), 1) },
  ].filter((group) => group.options.length > 1 || Boolean(filters[group.param]));
}

export function ArticleHub({ kind, basePath, filters, results, total, facets, afterSearch }: Props) {
  const basic = basicGroups(kind, facets, filters);
  const scoped = filters.domain ? hobbyGroups(facets, filters) : [];
  const groups = [...basic, ...scoped];
  const hobbyName =
    facets.find((row) => row.facet === "domain" && row.value === filters.domain)?.label ?? null;
  const page = filters.pagina ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / HUB_PAGE_SIZE));

  const active = groups.flatMap((group) => {
    const value = filters[group.param];
    if (!value) return [];
    const option = group.options.find((o) => o.value === value);
    return [{ param: group.param, label: `${group.title}: ${option?.label ?? facetLabel(value)}` }];
  });
  if (filters.q) active.unshift({ param: "q", label: `Zoekterm: ${filters.q}` });

  const copy =
    kind === "patterns"
      ? {
          noun: total === 1 ? "patroon" : "patronen",
          placeholder: "Bijvoorbeeld amigurumi, sjaal of baby",
          empty: "Geen patronen gevonden",
        }
      : {
          noun: total === 1 ? "artikel" : "artikelen",
          placeholder: "Bijvoorbeeld kaarten maken of keramiek",
          empty: "Geen artikelen gevonden",
        };

  const filterPanel = (
    <div className="flex flex-col gap-8">
      {basic.map((group) => (
        <FilterGroup key={group.param} group={group} basePath={basePath} filters={filters} />
      ))}
      {filters.domain ? (
        scoped.length > 0 ? (
          <div className="flex flex-col gap-8 rounded-2xl border border-[var(--border)] bg-[var(--section-alt)] p-4">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              Verfijn binnen {hobbyName ?? "deze hobby"}
            </p>
            {scoped.map((group) => (
              <FilterGroup key={group.param} group={group} basePath={basePath} filters={filters} />
            ))}
          </div>
        ) : null
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-3 text-base text-[var(--muted)]">
          Kies een hobby. Dan kun je ook filteren op techniek, thema en voor wie.
        </p>
      )}
    </div>
  );

  return (
    <div className="pb-16 md:pb-24">
      <form action={basePath} method="get" role="search" className="mx-auto max-w-3xl">
        {HUB_PARAM_KEYS.filter((k) => k !== "q" && filters[k]).map((k) => (
          <input key={k} type="hidden" name={k} value={filters[k]} />
        ))}
        <label htmlFor="hub-search" className="mb-3 block text-lg font-semibold text-[var(--foreground)]">
          Waar wil je mee aan de slag?
        </label>
        <div className="flex gap-3">
          <span className="relative block flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              size={20}
              aria-hidden
            />
            <input
              id="hub-search"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder={copy.placeholder}
              className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-3 pl-12 pr-4 text-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </span>
          <button
            type="submit"
            className="min-h-12 rounded-xl bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            Zoeken
          </button>
        </div>
      </form>

      {afterSearch}

      <div className="mt-12 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
        {groups.length > 0 ? (
          <aside aria-label="Filters">
            {/* Mobile: collapsed so results stay near the top. */}
            <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] lg:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-[var(--foreground)]">
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal size={20} aria-hidden />
                  Filters{active.length ? ` (${active.length})` : ""}
                </span>
                <span className="text-sm text-[var(--accent)] group-open:hidden">Openen</span>
                <span className="hidden text-sm text-[var(--accent)] group-open:inline">Sluiten</span>
              </summary>
              <div className="border-t border-[var(--border)] px-4 py-6">{filterPanel}</div>
            </details>
            <div className="hidden lg:sticky lg:top-24 lg:block">{filterPanel}</div>
          </aside>
        ) : null}

        <section aria-labelledby="hub-results" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="hub-results" className="text-2xl font-semibold text-[var(--foreground)]">
              {total} {copy.noun}
            </h2>
            {pageCount > 1 ? (
              <p className="text-base text-[var(--muted)]">
                Pagina {page} van {pageCount}
              </p>
            ) : null}
          </div>

          {active.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Actieve filters">
              {active.map((chip) => (
                <li key={chip.param}>
                  <Link
                    href={hrefWith(basePath, filters, {
                      [chip.param]: undefined,
                      ...(chip.param === "domain"
                        ? Object.fromEntries(HOBBY_SCOPED_KEYS.map((key) => [key, undefined]))
                        : {}),
                    })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--section-highlight)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card)]"
                    aria-label={`Verwijder filter ${chip.label}`}
                  >
                    {chip.label}
                    <X size={16} aria-hidden />
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={basePath}
                  className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                >
                  Alles wissen
                </Link>
              </li>
            </ul>
          ) : null}

          {results.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
              {results.map(({ article, domainName }) => (
                <ArticleCard key={article.id} article={article} domainName={domainName} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
              <p className="text-xl font-semibold text-[var(--foreground)]">{copy.empty}</p>
              <p className="mt-3 text-base text-[var(--muted)]">
                Probeer een andere zoekterm of verwijder een filter.
              </p>
              <Link
                href={basePath}
                className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)]"
              >
                Toon alles
              </Link>
            </div>
          )}

          {pageCount > 1 ? (
            <nav aria-label="Paginering" className="mt-12 flex items-center justify-between gap-4">
              {page > 1 ? (
                <Link
                  href={hrefWith(basePath, filters, { pagina: String(page - 1) })}
                  rel="prev"
                  className="inline-flex min-h-12 items-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 text-base font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
                >
                  Vorige
                </Link>
              ) : (
                <span />
              )}
              <span className="text-base text-[var(--muted)]">
                {page} / {pageCount}
              </span>
              {page < pageCount ? (
                <Link
                  href={hrefWith(basePath, filters, { pagina: String(page + 1) })}
                  rel="next"
                  className="inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-5 text-base font-semibold text-[var(--accent-foreground)] hover:opacity-90"
                >
                  Volgende
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function FilterGroup({
  group,
  basePath,
  filters,
}: {
  group: Group;
  basePath: string;
  filters: ArticleHubFilters;
}) {
  const current = filters[group.param];
  const chip = (option: Group["options"][number]) => {
    const isActive = current === option.value;
    return (
      <li key={option.value}>
        <Link
          href={hrefWith(basePath, filters, {
            ...Object.fromEntries((group.clears ?? []).map((key) => [key, undefined])),
            [group.param]: isActive ? undefined : option.value,
            pagina: undefined,
          })}
          aria-current={isActive ? "true" : undefined}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
            isActive
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
          }`}
        >
          {option.label}
          {option.n ? (
            <span className={isActive ? "opacity-80" : "text-[var(--muted)]"}>{option.n}</span>
          ) : null}
        </Link>
      </li>
    );
  };
  const visible = group.options.slice(0, VISIBLE_OPTIONS);
  const more = group.options.slice(VISIBLE_OPTIONS);
  // Keep an active value visible even when it sits in the "more" list.
  const activeHidden = more.find((o) => o.value === current);

  return (
    <fieldset>
      <legend className="mb-3 text-base font-semibold text-[var(--foreground)]">{group.title}</legend>
      <ul className="flex flex-wrap gap-2">
        {visible.map(chip)}
        {activeHidden ? chip(activeHidden) : null}
      </ul>
      {more.length > 0 ? (
        <details className="mt-3">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[var(--accent)]">
            Toon nog {more.length}
          </summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {more.filter((o) => o.value !== activeHidden?.value).map(chip)}
          </ul>
        </details>
      ) : null}
    </fieldset>
  );
}
