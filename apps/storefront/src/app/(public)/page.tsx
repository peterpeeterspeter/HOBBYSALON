import Link from "next/link";
import { getHomePageData } from "@/lib/services/home-page";
import { buildHeroSlides } from "@/lib/services/hero-slides";
import { HeroSlider } from "@/components/home/hero-slider";
import { DomainBar } from "@/components/home/domain-bar";
import { CTABanner } from "@/components/home/cta-banner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CardShell } from "@/components/ui/card-shell";
import {
  ProductCard,
  WorkshopCard,
  EventCard,
  ProjectCard,
} from "@/components/cards";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { GridLayout } from "@/components/layout/grid-layout";
import { Section } from "@/components/layout/section";
import { buildPageMetadata } from "@/lib/seo";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import type { CreatorWithStats } from "@/lib/platform/queries/creators";

export const metadata = buildPageMetadata({
  title: "Hobbysalon | Creatieve hobby community",
  description:
    "Ontdek handgemaakte producten, benodigdheden, workshops, events en inspiratie op Hobbysalon.",
  path: "/",
});
export const revalidate = 300;

const CREATOR_TYPE_LABELS: Record<string, string> = {
  maker: "Maker",
  workshopgever: "Workshopgever",
  supplier: "Leverancier",
  content_creator: "Content maker",
  organizer: "Organisator",
};

function CreatorFeatureCard({ creator }: { creator: CreatorWithStats }) {
  const firstType = creator.creator_types?.[0];
  const badgeLabel =
    creator.primary_domain_name ??
    (firstType ? (CREATOR_TYPE_LABELS[firstType] ?? firstType) : null);

  return (
    <Link href={`/creator/${creator.slug}`} className="block">
      <CardShell
        variant="interactive"
        padding="md"
        className="flex flex-col items-center text-center gap-3"
      >
        <Avatar src={creator.avatar_url} alt={creator.display_name} size="xl" />
        <div>
          <p className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--foreground)]">
            {creator.display_name}
          </p>
          {badgeLabel && (
            <div className="mt-2">
              <Badge variant="domain">{badgeLabel}</Badge>
            </div>
          )}
          {creator.workshop_count > 0 && (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {creator.workshop_count} workshop{creator.workshop_count === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </CardShell>
    </Link>
  );
}

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  tutorial: "Tutorial",
  guide: "Gids",
  inspiration: "Inspiratie",
  interview: "Interview",
  pattern: "Patroon",
};

export default async function HomePage() {
  let data: Awaited<ReturnType<typeof getHomePageData>> = {
    popularDomains: [],
    upcomingWorkshops: [],
    featuredHandmade: [],
    featuredSupplies: [],
    upcomingEvents: [],
    latestArticles: [],
    creatorsOfTheMonth: [],
    featuredProjects: [],
    recommendedProjects: [],
    recommendationSource: "cold_start",
    recommendationLatencyMs: 0,
    viewerUserId: null,
  };

  try {
    data = await getHomePageData();
  } catch {
    // Platform DB not configured or unavailable
  }

  const heroSlides = buildHeroSlides({
    featuredHandmade: data.featuredHandmade,
    featuredSupplies: data.featuredSupplies,
    upcomingWorkshops: data.upcomingWorkshops,
    upcomingEvents: data.upcomingEvents,
    latestArticles: data.latestArticles,
    creatorsOfTheMonth: data.creatorsOfTheMonth,
    featuredProjects: data.featuredProjects,
  });

  return (
    <>
      <h1 className="sr-only">Welkom bij Hobbysalon</h1>
      <p className="sr-only">
        Ontdek creatieve hobby&apos;s, makers, workshops, evenementen en inspiratie.
      </p>

      <TrackOnMount
        event="home_recommendations_viewed"
        payload={{
          recommendation_source: data.recommendationSource,
          item_count: data.recommendedProjects.length,
          latency_ms: data.recommendationLatencyMs,
          user_id: data.viewerUserId,
        }}
      />

      {/* ─── Hero — full-bleed 520px slider, leads the page (per design) ─── */}
      <HeroSlider slides={heroSlides} autoplayIntervalMs={6000} />

      {/* ─── Domain bar — pill navigation between hero and content ─── */}
      {data.popularDomains.length > 0 && (
        <DomainBar domains={data.popularDomains} />
      )}

      {/* ─── Workshops ─── */}
      {data.upcomingWorkshops.length > 0 && (
        <Section spacing="md">
          <Container>
            <SectionHeader
              title="Aankomende workshops"
              description="Leer van ervaren makers bij jou in de buurt"
              href="/workshops"
              linkText="Bekijk alle workshops"
            />
            <GridLayout cols={4} gap="md">
              {data.upcomingWorkshops.slice(0, 4).map((workshop) => (
                <WorkshopCard key={workshop.id} workshop={workshop} />
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {/* ─── Marketplace ─── */}
      {(data.featuredHandmade.length > 0 || data.featuredSupplies.length > 0) && (
        <Section variant="alt" spacing="md">
          <Container>
            <SectionHeader
              title="Handgemaakte spullen &amp; creatieve materialen"
              description="Ontdek unieke producten, materialen en creaties van Belgische en Nederlandse makers. Van handgemaakte kaarten tot keramiek, wol, accessoires en afgewerkte hobbyprojecten."
              href="/materials"
              linkText="Bekijk de marktplaats"
            />
            <GridLayout cols={4} gap="md">
              {[...data.featuredHandmade, ...data.featuredSupplies]
                .slice(0, 4)
                .map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {/* ─── Makers van de maand — 4-col centered grid ─── */}
      {data.creatorsOfTheMonth.length > 0 && (
        <Section spacing="md">
          <Container>
            <SectionHeader
              title="Makers van de maand"
              description="Ontdek creatieve makers, workshopgevers en kleine ateliers uit België en Nederland."
              href="/creators"
              linkText="Bekijk alle makers"
            />
            <GridLayout cols={4} gap="md">
              {data.creatorsOfTheMonth.slice(0, 4).map((creator) => (
                <CreatorFeatureCard key={creator.id} creator={creator} />
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {/* ─── Agenda ─── */}
      {data.upcomingEvents.length > 0 && (
        <Section variant="alt" spacing="md">
          <Container>
            <SectionHeader title="Aankomende evenementen" href="/agenda" linkText="Bekijk de agenda" />
            <GridLayout cols={3} gap="md">
              {data.upcomingEvents.slice(0, 3).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {/* ─── Inspiratie & artikelen — simple 3-col grid ─── */}
      {data.latestArticles.length > 0 && (
        <Section spacing="md">
          <Container>
            <SectionHeader
              title="Inspiratie &amp; tutorials"
              description="Gratis tutorials, patronen en creatieve gidsen. Start meteen met een nieuw project en bestel de materialen die je nodig hebt."
              href="/gratis-haakpatronen"
              linkText="Bekijk alle artikelen"
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.latestArticles.slice(0, 3).map((article) => (
                <Link
                  key={article.id}
                  href={`/artikel/${article.slug}`}
                  className="group/article block"
                >
                  <CardShell variant="interactive" padding="none">
                    {article.featured_image_url && (
                      <img
                        src={article.featured_image_url}
                        alt=""
                        className="aspect-video w-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                        {ARTICLE_TYPE_LABELS[article.article_type] ?? article.article_type}
                        {article.reading_time_minutes
                          ? ` · ${article.reading_time_minutes} min lezen`
                          : ""}
                      </p>
                      <h3 className="mt-1.5 font-[family-name:var(--font-heading)] text-base font-semibold leading-snug text-[var(--foreground)] line-clamp-2">
                        {article.title}
                      </h3>
                    </div>
                  </CardShell>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      )}

      {/* ─── Aanbevelingen — only when personalised or cold-start has data ─── */}
      {data.recommendedProjects.length > 0 && (
        <Section variant="highlight" spacing="md">
          <Container>
            <SectionHeader
              title={
                data.recommendationSource === "personalized"
                  ? "Aanbevolen voor jou"
                  : "Populaire projecten om direct te starten"
              }
              description={
                data.recommendationSource === "personalized"
                  ? "Gebaseerd op je profielinteresses, favorieten en recente interacties."
                  : "Projecten gebaseerd op populaire hobby's, actuele activiteit en inspiratie van Hobbysalon-makers."
              }
            />
            <GridLayout cols={3}>
              {data.recommendedProjects.map((item) => (
                <div key={item.project.id} className="space-y-2">
                  <ProjectCard project={item.project} />
                  <p className="text-xs text-[var(--muted)]">
                    {item.reasons[0] ?? "Aanbevolen project"}
                  </p>
                </div>
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {/* ─── Projecten ─── */}
      {data.featuredProjects.length > 0 && (
        <Section variant="alt" spacing="md">
          <Container>
            <SectionHeader title="Uitgelichte projecten" />
            <GridLayout cols={4}>
              {data.featuredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {/* ─── CTA Banner — dark background, full-bleed ─── */}
      <CTABanner
        variant="dark"
        title="Word maker op Hobbysalon"
        description="Verkoop je handgemaakte werk, geef workshops of deel je creatieve inspiratie met duizenden hobbyisten in België en Nederland."
        href="/register"
        ctaText="Start als workshopgever"
        secondaryHref="/register"
        secondaryText="Verkoop handgemaakt werk"
      />
    </>
  );
}
