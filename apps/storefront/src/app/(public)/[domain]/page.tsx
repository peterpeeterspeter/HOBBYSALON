import Link from "next/link";
import { notFound } from "next/navigation";
import { getDomainPageData } from "@/lib/services/domain-page";
import {
  ProductCard,
  WorkshopCard,
  ArticleCard,
  ProjectCard,
} from "@/components/cards";
import { ListingHeroBand } from "@/components/shared/ListingHeroBand";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/container";
import { getDomainPlaceholderImage } from "@/components/ui/ai-generated-image";
import { DateDisplay } from "@/components/domain/date-display";
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
  };

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
      label: `Leertrajecten (${learningPathTeasers.length})`,
      href: `/${domain.slug}/learning-paths`,
    },
  ].filter(Boolean) as { label: string; href: string }[];

  const imageSrc =
    domain.hero_image_url?.trim() || getDomainPlaceholderImage(domain.slug);

  return (
    <>
      <JsonLd data={domainJsonLd} />

      <ListingHeroBand
        title={domain.name}
        lead={domain.short_description ?? undefined}
        imageSrc={imageSrc}
        footer={
          <div className="flex flex-wrap items-center gap-3">
            <FavoriteToggleButton
              entityType="domain"
              entityId={domain.id}
              isFavorited={domainIsFavorite}
              nextPath={`/${domain.slug}`}
            />
            {quickNav.slice(0, 3).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-white/15 px-4 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                {link.label}
              </Link>
            ))}
          </div>
        }
      />

      {creators.length > 0 ? (
        <div className="border-b border-[var(--border)] bg-[var(--section-alt)]">
          <Container className="py-10 sm:py-12">
            <DomainSection
              title="Makers & workshopgevers"
              seeAllHref="/creators"
            >
              <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 snap-x snap-mandatory sm:-mx-6 sm:px-6 [scrollbar-width:thin]">
                {creators.slice(0, 8).map((c) => {
                  const name = c.business_name || c.display_name;
                  const photo = c.banner_url || c.avatar_url;
                  return (
                    <Link
                      key={c.id}
                      href={`/creator/${c.slug}`}
                      className="group w-44 shrink-0 snap-start sm:w-52"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-[var(--card)]">
                        {photo ? (
                          <img
                            src={photo}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            aria-hidden
                          >
                            <span className="font-[family-name:var(--font-heading)] text-4xl font-bold text-[var(--muted)]/35">
                              {name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <h3 className="mt-3 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
                        {name}
                      </h3>
                    </Link>
                  );
                })}
              </div>
            </DomainSection>
          </Container>
        </div>
      ) : null}

      <Container className="flex flex-col gap-14 py-10 sm:gap-16 sm:py-14">
        {workshops.length > 0 ? (
          <DomainSection
            title="Workshops"
            seeAllHref={`/${domain.slug}/workshops`}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workshops.slice(0, 6).map((w) => (
                <WorkshopCard key={w.id} workshop={w} />
              ))}
            </div>
          </DomainSection>
        ) : null}

        {events.length > 0 ? (
          <DomainSection title="Aankomende evenementen" seeAllHref="/agenda">
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {events.slice(0, 5).map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/agenda/${event.slug}`}
                    className="group grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-6"
                  >
                    <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--accent)]">
                      <DateDisplay date={event.starts_at} format="short" />
                    </span>
                    <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                      {event.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </DomainSection>
        ) : null}

        {articles.length > 0 ? (
          <DomainSection
            title="Artikelen & tutorials"
            seeAllHref={`/${domain.slug}/artikels`}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.slice(0, 6).map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </DomainSection>
        ) : null}

        {supplyProducts.length > 0 ? (
          <DomainSection
            title="Benodigdheden & materialen"
            seeAllHref={`/${domain.slug}/supplies`}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {supplyProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </DomainSection>
        ) : null}

        {handmadeProducts.length > 0 ? (
          <DomainSection
            title="Handgemaakte producten"
            seeAllHref={`/${domain.slug}/handmade`}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {handmadeProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </DomainSection>
        ) : null}

        {projects.length > 0 ? (
          <DomainSection title="Projecten om te starten">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </DomainSection>
        ) : null}

        {learningPathTeasers.length > 0 ? (
          <DomainSection
            title="Leertrajecten"
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
          </DomainSection>
        ) : null}
      </Container>
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
      className="block rounded-[1.25rem] border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--accent)]"
    >
      <p className="text-sm font-semibold text-[var(--muted)]">{difficultyLabel}</p>
      <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
        {path.title}
      </h3>
      {path.short_description ? (
        <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
          {path.short_description}
        </p>
      ) : null}
      <p className="mt-3 text-sm font-semibold text-[var(--accent)]">
        {path.step_count} stap{path.step_count === 1 ? "" : "pen"}
      </p>
    </Link>
  );
}

function DomainSection({
  title,
  seeAllHref,
  children,
}: {
  title: string;
  seeAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
          {title}
        </h2>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
          >
            Bekijk alles
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
