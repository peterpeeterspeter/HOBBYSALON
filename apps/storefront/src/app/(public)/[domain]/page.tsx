import Link from "next/link";
import { notFound } from "next/navigation";
import { getDomainPageData } from "@/lib/services/domain-page";
import { ProductCard, CreatorCard, WorkshopCard, EventCard, ArticleCard, ProjectCard } from "@/components/cards";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CardShell } from "@/components/ui/card-shell";
import { GridLayout } from "@/components/layout/grid-layout";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import { buildPageMetadata } from "@/lib/seo";
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

export default async function DomainPage({ params }: Props) {
  const { domain: slug } = await params;
  const data = await getDomainPageData(slug);

  if (!data.domain) notFound();

  const { domain, creators, handmadeProducts, supplyProducts } = data;
  const user = await getAuthUser();
  const domainIsFavorite = user
    ? await isFavorite(user.id, "domain", domain.id)
    : false;

  return (
    <Container className="py-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          {domain.name}
        </h1>
        {domain.short_description && (
          <p className="mt-2 text-lg text-[var(--muted)]">
            {domain.short_description}
          </p>
        )}
        {domain.hero_image_url && (
          <div className="mt-6 aspect-video overflow-hidden rounded-lg bg-[var(--border)]">
            <img
              src={domain.hero_image_url}
              alt={domain.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="mt-4">
          <FavoriteToggleButton
            entityType="domain"
            entityId={domain.id}
            isFavorited={domainIsFavorite}
            nextPath={`/${domain.slug}`}
          />
        </div>
      </header>

      <section className="mt-10">
        <SectionHeader title="Makers & leveranciers" />
        {creators.length > 0 ? (
          <GridLayout cols={3}>
            {creators.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </GridLayout>
        ) : (
          <EmptyState
            title="Nog geen creators"
            description="Nog geen creators in dit domein."
          />
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Handgemaakt"
          href={handmadeProducts.length > 0 ? `/${domain.slug}/handmade` : undefined}
          linkText="Alle producten"
        />
        {handmadeProducts.length > 0 ? (
          <GridLayout cols={4}>
            {handmadeProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </GridLayout>
        ) : (
          <EmptyState
            title="Nog geen handgemaakte producten"
            description="Nog geen handgemaakte producten in dit domein."
          />
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Benodigdheden"
          href={supplyProducts.length > 0 ? `/${domain.slug}/supplies` : undefined}
          linkText="Alle benodigdheden"
        />
        {supplyProducts.length > 0 ? (
          <GridLayout cols={4}>
            {supplyProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </GridLayout>
        ) : (
          <EmptyState
            title="Nog geen benodigdheden"
            description="Nog geen benodigdheden in dit domein."
          />
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Workshops"
          href={data.workshops.length > 0 ? `/${domain.slug}/workshops` : undefined}
        />
        {data.workshops.length > 0 ? (
          <GridLayout cols={3}>
            {data.workshops.map((w) => (
              <WorkshopCard key={w.id} workshop={w} />
            ))}
          </GridLayout>
        ) : (
          <EmptyState
            title="Nog geen workshops"
            description="Nog geen workshops in dit domein."
          />
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Evenementen"
          href={data.events.length > 0 ? "/agenda" : undefined}
          linkText="Volledige agenda"
        />
        {data.events.length > 0 ? (
          <GridLayout cols={3}>
            {data.events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </GridLayout>
        ) : (
          <EmptyState
            title="Nog geen evenementen"
            description="Nog geen evenementen in dit domein."
          />
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Inspiratie & artikelen"
          href={data.articles.length > 0 ? `/${domain.slug}/artikels` : undefined}
        />
        {data.articles.length > 0 ? (
          <GridLayout cols={3}>
            {data.articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </GridLayout>
        ) : (
          <EmptyState
            title="Nog geen artikelen"
            description="Nog geen artikelen in dit domein."
          />
        )}
      </section>

      <section className="mt-10">
        <SectionHeader title="Projecten om te starten" />
        {data.projects.length > 0 ? (
          <GridLayout cols={3}>
            {data.projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </GridLayout>
        ) : (
          <EmptyState
            title="Nog geen projecten"
            description="Nog geen projecten in dit domein."
          />
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Learning paths"
          href={data.learningPathTeasers.length > 0 ? `/${domain.slug}/learning-paths` : undefined}
        />
        {data.learningPathTeasers.length > 0 ? (
          <GridLayout cols={3}>
            {data.learningPathTeasers.map((path) => (
              <CardShell key={path.id} variant="interactive" padding="md">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                  {path.difficulty_level}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                  {path.title}
                </h3>
                {path.short_description && (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {path.short_description}
                  </p>
                )}
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {path.step_count} stap{path.step_count === 1 ? "" : "pen"}
                </p>
                <Link
                  href={`/${domain.slug}/learning-paths/${path.slug}`}
                  className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  Open learning path →
                </Link>
              </CardShell>
            ))}
          </GridLayout>
        ) : (
          <EmptyState
            title="Nog geen learning paths"
            description="Nog geen learning paths in dit domein."
          />
        )}
      </section>
    </Container>
  );
}
