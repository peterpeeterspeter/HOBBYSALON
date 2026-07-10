import Link from "next/link";
import { notFound } from "next/navigation";
import { getDomainPageData } from "@/lib/services/domain-page";
import {
  ProductCard,
  CreatorCard,
  WorkshopCard,
  EventCard,
  ArticleCard,
  ProjectCard,
} from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import type { LearningPathWithStepCount } from "@/lib/platform/queries/learning-paths";
import type { Metadata } from "next";

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain: slug } = await params;
  const { domain } = await getDomainPageData(slug);
  if (!domain) return { title: "Niet gevonden" };
  return buildPageMetadata({
    title: domain.seo_title ?? `${domain.name} | Hobbysalon`,
    description: domain.seo_description ?? domain.short_description ?? undefined,
    path: `/${domain.slug}`,
    image: domain.hero_image_url,
  });
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Gevorderd",
  advanced: "Expert",
};

export default async function DomainPage({ params }: Props) {
  const { domain: slug } = await params;
  const data = await getDomainPageData(slug);
  if (!data.domain) notFound();

  const {
    domain,
    creators,
    handmadeProducts,
    supplyProducts,
    workshops,
    events,
    articles,
    projects,
    learningPathTeasers,
  } = data;

  const user = await getAuthUser();
  const domainIsFavorite = user
    ? await isFavorite(user.id, "domain", domain.id)
    : false;

  const domainJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl(`/${domain.slug}#collection`),
    url: absoluteUrl(`/${domain.slug}`),
    name: domain.name,
    description:
      domain.seo_description ??
      domain.short_description ??
      domain.long_description ??
      undefined,
    image: domain.hero_image_url
      ? absoluteUrl(domain.hero_image_url)
      : undefined,
    isPartOf: {
      "@type": "WebSite",
      name: "Hobbysalon",
      url: absoluteUrl("/"),
    },
    about: { "@type": "Thing", name: domain.name },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems:
        creators.length + articles.length + workshops.length,
      itemListElement: [
        ...creators.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absoluteUrl(`/creator/${c.slug}`),
          name: c.display_name,
        })),
        ...articles.map((a, i) => ({
          "@type": "ListItem",
          position: creators.length + i + 1,
          url: absoluteUrl(`/artikel/${a.slug}`),
          name: a.title,
        })),
        ...workshops.map((w, i) => ({
          "@type": "ListItem",
          position: creators.length + articles.length + i + 1,
          url: absoluteUrl(`/workshop/${w.slug}`),
          name: w.title,
        })),
      ],
    },
  };

  // Quick-nav links for non-empty sub-sections
  const quickNav = [
    workshops.length > 0 && {
      label: `Workshops (${workshops.length})`,
      href: `/${domain.slug}/workshops`,
    },
    articles.length > 0 && {
      label: `Artikelen (${articles.length})`,
      href: `/${domain.slug}/artikels`,
    },
    supplyProducts.length > 0 && {
      label: `Benodigdheden (${supplyProducts.length})`,
      href: `/${domain.slug}/supplies`,
    },
    learningPathTeasers.length > 0 && {
      label: `Learning paths (${learningPathTeasers.length})`,
      href: `/${domain.slug}/learning-paths`,
    },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <>
      <JsonLd data={domainJsonLd} />

      {/* Hero */}
      <div className="relative h-[280px] overflow-hidden sm:h-[340px] lg:h-[380px]">
        {domain.hero_image_url ? (
          <img
            src={domain.hero_image_url}
            alt={domain.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--color-amber-500)] to-[var(--color-amber-700)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(77,59,42,0.88)] via-[rgba(77,59,42,0.30)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-7 sm:pb-8">
            {domain.icon_url && (
              <img
                src={domain.icon_url}
                alt=""
                className="mb-2 h-10 w-10 rounded-full object-cover"
                loading="eager"
              />
            )}
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight text-white sm:text-4xl">
              {domain.name}
            </h1>
            {domain.short_description && (
              <p className="mt-1.5 max-w-2xl text-[15px] text-white/85">
                {domain.short_description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Meta + quick-nav bar */}
      <div className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <FavoriteToggleButton
            entityType="domain"
            entityId={domain.id}
            isFavorited={domainIsFavorite}
            nextPath={`/${domain.slug}`}
          />
          {quickNav.length > 0 && (
            <nav
              aria-label="Domein navigatie"
              className="scrollbar-hide flex flex-1 gap-3 overflow-x-auto"
            >
              {quickNav.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="shrink-0 rounded-full border border-[var(--border)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        {creators.length > 0 && (
          <GraphSection
            tag="Makers"
            title="Makers & workshopgevers"
            subtitle={`${creators.length} creator${creators.length !== 1 ? "s" : ""} actief in ${domain.name}`}
            seeAllHref="/creators"
          >
            <GridLayout cols={4} gap="md">
              {creators.slice(0, 8).map((c) => (
                <CreatorCard key={c.id} creator={c} />
              ))}
            </GridLayout>
          </GraphSection>
        )}

        {workshops.length > 0 && (
          <GraphSection
            tag="Workshops"
            title="Workshops"
            seeAllHref={`/${domain.slug}/workshops`}
          >
            <GridLayout cols={3} gap="md">
              {workshops.slice(0, 6).map((w) => (
                <WorkshopCard key={w.id} workshop={w} />
              ))}
            </GridLayout>
          </GraphSection>
        )}

        {events.length > 0 && (
          <GraphSection
            tag="Agenda"
            title="Aankomende evenementen"
            seeAllHref="/agenda"
          >
            <GridLayout cols={3} gap="md">
              {events.slice(0, 3).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </GridLayout>
          </GraphSection>
        )}

        {articles.length > 0 && (
          <GraphSection
            tag="Inspiratie"
            title="Artikelen & tutorials"
            seeAllHref={`/${domain.slug}/artikels`}
          >
            <GridLayout cols={3} gap="md">
              {articles.slice(0, 6).map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </GridLayout>
          </GraphSection>
        )}

        {supplyProducts.length > 0 && (
          <GraphSection
            tag="Marktplaats"
            title="Benodigdheden & materialen"
            seeAllHref={`/${domain.slug}/supplies`}
          >
            <GridLayout cols={4} gap="md">
              {supplyProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </GridLayout>
          </GraphSection>
        )}

        {handmadeProducts.length > 0 && (
          <GraphSection
            tag="Handgemaakt"
            title="Handgemaakte producten"
            seeAllHref={`/${domain.slug}/handmade`}
          >
            <GridLayout cols={4} gap="md">
              {handmadeProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </GridLayout>
          </GraphSection>
        )}

        {projects.length > 0 && (
          <GraphSection tag="Projecten" title="Projecten om te starten">
            <GridLayout cols={3} gap="md">
              {projects.slice(0, 6).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </GridLayout>
          </GraphSection>
        )}

        {learningPathTeasers.length > 0 && (
          <GraphSection
            tag="Leertrajecten"
            title="Learning paths"
            subtitle="Van beginner tot gevorderd — stap voor stap."
            seeAllHref={`/${domain.slug}/learning-paths`}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {learningPathTeasers.map((path) => (
                <LearningPathCard
                  key={path.id}
                  path={path}
                  domainSlug={domain.slug}
                />
              ))}
            </div>
          </GraphSection>
        )}
      </div>
    </>
  );
}

function LearningPathCard({
  path,
  domainSlug,
}: {
  path: LearningPathWithStepCount;
  domainSlug: string;
}) {
  const difficultyLabel =
    DIFFICULTY_LABELS[path.difficulty_level] ?? path.difficulty_level;

  return (
    <Link
      href={`/${domainSlug}/learning-paths/${path.slug}`}
      className="block"
    >
      <div className="flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition-all hover:border-[var(--accent)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 motion-reduce:hover:transform-none">
        <span className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
          {difficultyLabel}
        </span>
        <h3 className="font-[family-name:var(--font-heading)] font-bold text-[var(--foreground)]">
          {path.title}
        </h3>
        {path.short_description && (
          <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-[var(--muted)]">
            {path.short_description}
          </p>
        )}
        <p className="mt-3 text-xs text-[var(--muted)]">
          {path.step_count} stap{path.step_count === 1 ? "" : "pen"}
        </p>
      </div>
    </Link>
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
      {subtitle && (
        <p className="mb-5 text-[15px] text-[var(--muted)]">{subtitle}</p>
      )}
      {!subtitle && <div className="mb-5" />}
      {children}
    </section>
  );
}
