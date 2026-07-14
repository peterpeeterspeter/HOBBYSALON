import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, Calendar } from "lucide-react";
import { getArticlePageData } from "@/lib/services/article-page";
import {
  ProductCard,
  WorkshopCard,
  CreatorCard,
  EventCard,
  ArticleCard,
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
      <div className="article-print-hero relative h-[320px] overflow-hidden sm:h-[380px] lg:h-[420px]">
        {article.featured_image_url ? (
          <img
            src={article.featured_image_url}
            alt={article.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--color-amber-500)] to-[var(--color-amber-700)]" />
        )}
        <div className="article-print-hero-overlay absolute inset-0 bg-gradient-to-t from-[rgba(77,59,42,0.90)] via-[rgba(77,59,42,0.30)] to-transparent" />
        <div className="article-print-hero-content absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-3xl px-4 pb-8 sm:pb-9">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--accent-light)]">
              {typeLabel}
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-[2.25rem]">
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
            <GraphSection tag="Benodigd" title="Dit heb je nodig" seeAllHref="/materials">
              <GridLayout cols={4} gap="md">
                {requiredMaterials.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {requiredTools.length > 0 && (
            <GraphSection tag="Gereedschap" title="Benodigd gereedschap" seeAllHref="/materials">
              <GridLayout cols={4} gap="md">
                {requiredTools.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {optionalMaterials.length > 0 && (
            <GraphSection tag="Optioneel" title="Handig om erbij te hebben" seeAllHref="/materials">
              <GridLayout cols={4} gap="md">
                {optionalMaterials.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {nextSteps.length > 0 && (
            <GraphSection tag="Volgende stap" title="Ga verder met deze stap">
              <GridLayout cols={3} gap="md">
                {nextSteps.map((nextArticle) => (
                  <ArticleCard key={nextArticle.id} article={nextArticle} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {relatedArticles.length > 0 && (
            <GraphSection tag="Lees ook" title="Meer over dit onderwerp" seeAllHref="/artikelen">
              <GridLayout cols={3} gap="md">
                {relatedArticles.map((relatedArticle) => (
                  <ArticleCard key={relatedArticle.id} article={relatedArticle} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {relatedWorkshops.length > 0 && (
            <GraphSection
              tag="Workshops"
              title="Leer dit in een workshop"
              seeAllHref="/workshops"
            >
              <GridLayout cols={3} gap="md">
                {relatedWorkshops.map((w) => (
                  <WorkshopCard key={w.id} workshop={w} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {relatedProducts.length > 0 && (
            <GraphSection
              tag="Materialen"
              title="Dit heb je nodig"
              seeAllHref="/materials"
            >
              <GridLayout cols={4} gap="md">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {relatedCreators.length > 0 && (
            <GraphSection
              tag="Creators"
              title="Van deze makers"
              seeAllHref="/creators"
            >
              <GridLayout cols={4} gap="md">
                {relatedCreators.map((c) => (
                  <CreatorCard key={c.id} creator={c} />
                ))}
              </GridLayout>
            </GraphSection>
          )}

          {relatedEvents.length > 0 && (
            <GraphSection
              tag="Agenda"
              title="Ontdek het in het echt"
              seeAllHref="/agenda"
            >
              <GridLayout cols={3} gap="md">
                {relatedEvents.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </GridLayout>
            </GraphSection>
          )}
        </div>
      )}
    </div>
  );
}

function GraphSection({
  tag,
  title,
  subtitle,
  seeAllHref,
  children,
}: {
  tag: string;
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-1.5 flex items-center gap-3">
        <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--accent)]">
          {tag}
        </span>
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
          {title}
        </h2>
        <span className="hidden h-px flex-1 bg-[var(--border)] sm:block" />
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="shrink-0 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Bekijk alles →
          </Link>
        )}
      </div>
      {subtitle && <p className="mb-5 text-[15px] text-[var(--muted)]">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      {children}
    </section>
  );
}
