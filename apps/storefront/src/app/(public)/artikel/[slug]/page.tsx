import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, Calendar } from "lucide-react";
import { getArticlePageData } from "@/lib/services/article-page";
import {
  ProductCard,
} from "@/components/cards";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { StartSavedProjectButton } from "@/components/profile/StartSavedProjectButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { MarkdownContent } from "@/components/content/markdown-content";
import { DifficultyBadge } from "@/components/content/DifficultyBadge";
import { PrintArticleButton } from "@/components/content/PrintArticleButton";
import { CommunityGallery } from "@/components/content/CommunityGallery";
import { CommunityProjectSubmission } from "@/components/content/CommunityProjectSubmission";
import { GridLayout } from "@/components/layout/grid-layout";
import { getAuthUser } from "@/lib/auth/session";
import { isPrintableArticleType } from "@/lib/content/printable-article";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { listProjectsByUserId } from "@/lib/platform/queries/projects";
import { listOwnerCommunitySubmissionsForArticle } from "@/lib/platform/queries/community-showcase";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildHowToSchema,
} from "@/lib/schema";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  tutorial: "Tutorial",
  guide: "Gids",
  inspiration: "Inspiratie",
  interview: "Interview",
  pattern: "Patroon",
};

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { article } = await getArticlePageData(slug);
  if (!article) return { title: "Niet gevonden" };
  return buildPageMetadata({
    title: article.seo_title ?? `${article.title} | Hobbysalon`,
    description: article.seo_description ?? article.excerpt ?? undefined,
    path: `/artikel/${article.slug}`,
    image: article.featured_image_url,
    type: "article",
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const data = await getArticlePageData(slug);
  if (!data.article) notFound();

  const {
    article,
    author,
    requiredMaterials,
    requiredTools,
    optionalMaterials,
    relatedProducts,
    nextSteps,
    relatedArticles,
    relatedWorkshops,
    relatedCreators,
    relatedEvents,
    communityProjects,
  } = data;

  const user = await getAuthUser();
  const articleIsFavorite = user
    ? await isFavorite(user.id, "article", article.id)
    : false;
  const [userProjects, ownerCommunitySubmissions] = user
    ? await Promise.all([
        listProjectsByUserId(user.id),
        listOwnerCommunitySubmissionsForArticle(article.id, user.id),
      ])
    : [[], []];

  const typeLabel = ARTICLE_TYPE_LABELS[article.article_type] ?? article.article_type;
  const publishDate = article.published_at ?? article.created_at;
  const isPrintable = isPrintableArticleType(article.article_type);

  const articleJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt ?? undefined,
    image: article.featured_image_url
      ? [absoluteUrl(article.featured_image_url)]
      : undefined,
    datePublished: publishDate,
    dateModified: article.updated_at,
    author: author
      ? { "@type": "Person", name: author.display_name }
      : { "@type": "Organization", name: "Hobbysalon" },
    publisher: {
      "@type": "Organization",
      name: "Hobbysalon",
      url: absoluteUrl("/"),
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(`/artikel/${article.slug}`),
    },
  };

  // Breadcrumb schema (visual breadcrumbs already in layout, add structured data)
  const breadcrumbJsonLd = buildBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Artikelen", path: "/artikelen" },
    { name: article.title, path: `/artikel/${article.slug}` },
  ]);

  // Collect all schemas — BlogPosting always, Breadcrumb always, FAQ/HowTo when available
  const allSchemas: Record<string, unknown>[] = [articleJsonLd, breadcrumbJsonLd];

  if (article.body_markdown) {
    const faqSchema = buildFaqSchema(article.body_markdown);
    if (faqSchema) allSchemas.push(faqSchema);

    const howToSchema = buildHowToSchema(
      article.body_markdown,
      article.title,
      article.featured_image_url
    );
    if (howToSchema) allSchemas.push(howToSchema);
  }

  return (
    <div className={isPrintable ? "printable-article-page" : undefined}>
      <JsonLd data={articleJsonLd} />

      {/* Hero */}
      <div className="article-print-hero relative h-[320px] overflow-hidden sm:h-[400px] lg:h-[460px]">
        {article.featured_image_url ? (
          <img
            src={article.featured_image_url}
            alt={article.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--color-amber-500)] to-[var(--color-amber-700)]" />
        )}
        <div className="article-print-hero-overlay absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/92 via-[var(--foreground)]/45 to-[var(--foreground)]/15" />
        <div className="article-print-hero-content absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-3xl px-4 pb-8 sm:pb-9">
            <p className="mb-2 text-sm font-semibold text-white/80">
              {typeLabel}
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight tracking-[-0.03em] text-white sm:text-3xl lg:text-[2.25rem]">
              {article.title}
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Meta bar */}
        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--border)] pb-5">
          {author && (
            <Link
              href={`/creator/${author.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
            >
              {author.avatar_url ? (
                <img
                  src={author.avatar_url}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/15 font-[family-name:var(--font-heading)] font-bold text-[var(--accent)]">
                  {author.display_name.charAt(0)}
                </span>
              )}
              {author.display_name}
            </Link>
          )}
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
            <Calendar size={14} aria-hidden />
            {dateFmt.format(new Date(publishDate))}
          </span>
          {article.reading_time_minutes && (
            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
              <Clock size={14} aria-hidden />
              {article.reading_time_minutes} min lezen
            </span>
          )}
          <DifficultyBadge difficulty={article.difficulty_level} />
          <div className="article-print-interactions ml-auto flex items-center gap-2">
            {isPrintable && <PrintArticleButton />}
            <FavoriteToggleButton
              entityType="article"
              entityId={article.id}
              isFavorited={articleIsFavorite}
              nextPath={`/artikel/${article.slug}`}
            />
          </div>
        </div>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="mb-8 text-[18px] font-medium leading-relaxed text-[var(--muted)]">
            {article.excerpt}
          </p>
        )}

        <section className="article-print-interactions mb-8 rounded-xl border border-[var(--accent)]/30 bg-[var(--section-highlight)] p-5" aria-labelledby="maakroute-heading">
          <p className="text-sm font-semibold text-[var(--accent)]">Van inspiratie naar maken</p>
          <h2 id="maakroute-heading" className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
            {articleIsFavorite ? "Klaar om dit te maken?" : "Wil je dit later maken?"}
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            {articleIsFavorite
              ? "Start je persoonlijke project. Daarna kun je benodigdheden afvinken en eigen notities bewaren."
              : "Bewaar dit eerst. Daarna kun je het als persoonlijk project starten, materialen afvinken en notities toevoegen."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {articleIsFavorite ? (
              <StartSavedProjectButton entityType="article" entityId={article.id} />
            ) : (
              <FavoriteToggleButton
                entityType="article"
                entityId={article.id}
                isFavorited={false}
                nextPath={`/artikel/${article.slug}`}
              />
            )}
            <Link href="/favorites" className="text-sm font-semibold text-[var(--accent)] underline underline-offset-4">
              Bekijk bewaarde ideeën
            </Link>
          </div>
        </section>

        <CommunityProjectSubmission
          articleId={article.id}
          projects={userProjects}
          submissions={ownerCommunitySubmissions}
        />

        {/* Body */}
        {article.body_markdown ? (
          <MarkdownContent
            markdown={article.body_markdown}
            className="prose-article text-[17px]"
          />
        ) : null}

        {/* Breadcrumb trail */}
        <nav
          aria-label="Breadcrumb"
          className="article-print-breadcrumb mt-10 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]"
        >
          <ol className="flex flex-wrap gap-2">
            <li>
              <Link href="/" className="hover:text-[var(--foreground)]">
                Home
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/artikelen" className="hover:text-[var(--foreground)]">
                Artikelen
              </Link>
            </li>
            <li>/</li>
            <li className="text-[var(--foreground)]">{article.title}</li>
          </ol>
        </nav>
      </div>

      {/* Graph sections */}
      {(requiredMaterials.length > 0 ||
        requiredTools.length > 0 ||
        optionalMaterials.length > 0 ||
        relatedProducts.length > 0 ||
        nextSteps.length > 0 ||
        relatedArticles.length > 0 ||
        relatedWorkshops.length > 0 ||
        relatedCreators.length > 0 ||
        relatedEvents.length > 0 ||
        communityProjects.length > 0) && (
        <div className="article-print-recommendations mx-auto max-w-6xl px-4 pb-12">
          <CommunityGallery projects={communityProjects} />
          {requiredMaterials.length > 0 && (
            <GraphSection title="Dit heb je nodig" seeAllHref="/materials">
              <GridLayout cols={4} gap="md">
                {requiredMaterials.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {requiredTools.length > 0 && (
            <GraphSection title="Benodigd gereedschap" seeAllHref="/materials">
              <GridLayout cols={4} gap="md">
                {requiredTools.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {optionalMaterials.length > 0 && (
            <GraphSection title="Handig om erbij te hebben" seeAllHref="/materials">
              <GridLayout cols={4} gap="md">
                {optionalMaterials.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {nextSteps.length > 0 && (
            <GraphSection title="Ga verder met deze stap">
              <EditorialArticleStrip articles={nextSteps} />
            </GraphSection>
          )}

          {relatedArticles.length > 0 && (
            <GraphSection title="Meer over dit onderwerp" seeAllHref="/artikelen">
              <EditorialArticleStrip articles={relatedArticles} />
            </GraphSection>
          )}

          {relatedWorkshops.length > 0 && (
            <GraphSection title="Leer dit in een workshop" seeAllHref="/workshops">
              <EditorialWorkshopStrip workshops={relatedWorkshops} />
            </GraphSection>
          )}

          {relatedProducts.length > 0 && (
            <GraphSection title="Dit heb je nodig" seeAllHref="/materials">
              <GridLayout cols={4} gap="md">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {relatedCreators.length > 0 && (
            <GraphSection title="Van deze makers" seeAllHref="/creators">
              <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                {relatedCreators.map((c) => (
                  <Link
                    key={c.id}
                    href={`/creator/${c.slug}`}
                    className="group w-36 shrink-0 sm:w-40"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-[var(--section-alt)]">
                      {c.avatar_url ? (
                        <img
                          src={c.avatar_url}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--muted)]/40">
                          {c.display_name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--foreground)] line-clamp-2">
                      {c.display_name}
                    </p>
                  </Link>
                ))}
              </div>
            </GraphSection>
          )}

          {relatedEvents.length > 0 && (
            <GraphSection title="Ontdek het in het echt" seeAllHref="/agenda">
              <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {relatedEvents.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/agenda/${e.slug}`}
                      className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
                    >
                      {e.featured_image_url ? (
                        <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
                          <img
                            src={e.featured_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--muted)]">
                          {e.city?.trim() || e.location_name?.trim() || "Locatie volgt"}
                        </p>
                        <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                          {e.title}
                        </h3>
                      </div>
                      <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
                        Bekijk
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </GraphSection>
          )}
        </div>
      )}
    </div>
  );
}

function GraphSection({
  title,
  subtitle,
  seeAllHref,
  children,
}: {
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-[15px] text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="shrink-0 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Bekijk alles
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EditorialArticleStrip({
  articles,
}: {
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt?: string | null;
    featured_image_url?: string | null;
    article_type?: string;
  }>;
}) {
  return (
    <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
      {articles.map((article) => (
        <li key={article.id}>
          <Link
            href={`/artikel/${article.slug}`}
            className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
          >
            {article.featured_image_url ? (
              <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
                <img
                  src={article.featured_image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                {article.title}
              </h3>
              {article.excerpt ? (
                <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                  {article.excerpt}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
              Lees
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EditorialWorkshopStrip({
  workshops,
}: {
  workshops: Array<{
    id: string;
    slug: string;
    title: string;
    city?: string | null;
    location_name?: string | null;
    featured_image_url?: string | null;
  }>;
}) {
  return (
    <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
      {workshops.map((w) => (
        <li key={w.id}>
          <Link
            href={`/workshop/${w.slug}`}
            className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
          >
            {w.featured_image_url ? (
              <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
                <img
                  src={w.featured_image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--muted)]">
                {w.city?.trim() || w.location_name?.trim() || "Workshop"}
              </p>
              <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                {w.title}
              </h3>
            </div>
            <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
              Bekijk
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
