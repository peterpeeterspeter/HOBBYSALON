import Link from "next/link";
import { getHomePageData } from "@/lib/services/home-page";
import { buildHeroSlides } from "@/lib/services/hero-slides";
import { HeroSlider } from "@/components/home/hero-slider";
import { ProductCard, WorkshopCard, EventCard, ArticleCard, CreatorCard, ProjectCard } from "@/components/cards";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { getDomainPlaceholderImage } from "@/components/ui/ai-generated-image";
import { EmptyState } from "@/components/ui/empty-state";
import { GridLayout } from "@/components/layout/grid-layout";
import { Section } from "@/components/layout/section";
import { buildPageMetadata } from "@/lib/seo";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";

export const metadata = buildPageMetadata({
  title: "Hobbysalon | Creatieve hobby community",
  description:
    "Ontdek handgemaakte producten, benodigdheden, workshops, events en inspiratie op Hobbysalon.",
  path: "/",
});

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
      <HeroSlider slides={heroSlides} autoplayIntervalMs={6000} />

      <TrackOnMount
        event="home_recommendations_viewed"
        payload={{
          recommendation_source: data.recommendationSource,
          item_count: data.recommendedProjects.length,
          latency_ms: data.recommendationLatencyMs,
          user_id: data.viewerUserId,
        }}
      />
      <h1 className="sr-only">Welkom bij Hobbysalon</h1>
      <p className="sr-only">
        Ontdek creatieve hobby&apos;s, makers, workshops, evenementen en inspiratie.
      </p>

      {/* Marketplace — default background */}
      <Section spacing="lg">
        <Container>
          <SectionHeader
            title="Marketplace"
            description="Ontdek handgemaakt werk van creators en materiaal van hobbywinkels."
          />

          <div className="mt-6">
            <SectionHeader subtle title="Uitgelicht handgemaakt" />
            <GridLayout cols={4}>
              {data.featuredHandmade.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </GridLayout>
          </div>

          <div className="mt-10">
            <SectionHeader
              subtle
              title="Uitgelichte benodigdheden"
              href="/materials"
              linkText="Naar materials marketplace"
            />
            <GridLayout cols={4}>
              {data.featuredSupplies.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </GridLayout>
          </div>
        </Container>
      </Section>

      {/* Populaire domeinen — alt background */}
      <Section variant="alt" spacing="md">
        <Container>
          <SectionHeader title="Populaire domeinen" />
          <GridLayout cols={4}>
            {data.popularDomains.map((domain) => (
              <Link key={domain.id} href={`/${domain.slug}`} className="block">
                <CardShell variant="interactive" padding="md">
                  <AspectImage
                    ratio="square"
                    src={domain.hero_image_url ?? getDomainPlaceholderImage(domain.slug)}
                    alt={domain.name}
                    className="-mx-4 -mt-4 mb-3 rounded-b-none"
                  />
                  <h3 className="font-semibold text-[var(--foreground)]">{domain.name}</h3>
                  {domain.short_description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                      {domain.short_description}
                    </p>
                  )}
                </CardShell>
              </Link>
            ))}
          </GridLayout>
        </Container>
      </Section>

      {/* Aanbevelingen — highlight (warm terracotta tint) */}
      <Section variant="highlight" spacing="md">
        <Container>
          <SectionHeader
            title={
              data.recommendationSource === "personalized"
                ? "Aanbevolen voor jou"
                : "Populaire projecten om te starten"
            }
            description={
              data.recommendationSource === "personalized"
                ? "Gebaseerd op je profielinteresses, favorieten, domeingedrag en recente interacties."
                : "Gebaseerd op domeinpopulariteit en actuele activiteit op Hobbysalon."
            }
          />
          {data.recommendedProjects.length > 0 ? (
            <GridLayout cols={3}>
              {data.recommendedProjects.map((item) => (
                <div key={item.project.id} className="space-y-2">
                  <ProjectCard project={item.project} />
                  <p className="text-xs text-[var(--muted)]">{item.reasons[0] ?? "Aanbevolen project"}</p>
                </div>
              ))}
            </GridLayout>
          ) : (
            <EmptyState
              compact
              title="Nog geen aanbevelingen"
              description="Voeg interesses toe in je profiel en markeer favorieten om persoonlijke aanbevelingen te ontvangen."
            />
          )}
        </Container>
      </Section>

      {/* Workshops — default, with divider */}
      <Section spacing="md" divider>
        <Container>
          <SectionHeader title="Aankomende workshops" href="/workshops" />
          <GridLayout cols={3}>
            {data.upcomingWorkshops.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </GridLayout>
        </Container>
      </Section>

      {/* Agenda — alt background */}
      <Section variant="alt" spacing="md">
        <Container>
          <SectionHeader title="Agenda teaser" href="/agenda" />
          <GridLayout cols={3}>
            {data.upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </GridLayout>
        </Container>
      </Section>

      {/* Artikelen — default */}
      <Section spacing="md">
        <Container>
          <SectionHeader title="Inspiratieartikelen" />
          <GridLayout cols={3}>
            {data.latestArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </GridLayout>
        </Container>
      </Section>

      {/* Projecten — alt background */}
      <Section variant="alt" spacing="md">
        <Container>
          <SectionHeader title="Projecten om direct te starten" />
          <GridLayout cols={4}>
            {data.featuredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </GridLayout>
        </Container>
      </Section>

      {/* Creators — default, with divider */}
      <Section spacing="lg" divider>
        <Container>
          <SectionHeader title="Creators van de maand" href="/creators" />
          <GridLayout cols={3}>
            {data.creatorsOfTheMonth.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </GridLayout>
        </Container>
      </Section>
    </>
  );
}
