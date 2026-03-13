import { getHomePageData } from "@/lib/services/home-page";
import { buildHeroSlides } from "@/lib/services/hero-slides";
import { HeroSlider } from "@/components/home/hero-slider";
import { FeaturedBanner } from "@/components/home/featured-banner";
import { CTABanner } from "@/components/home/cta-banner";
import { DomainPills } from "@/components/home/domain-pills";
import { CreatorSpotlight } from "@/components/home/creator-spotlight";
import { ArticleFeature } from "@/components/home/article-feature";
import { ProductCard, WorkshopCard, EventCard, ProjectCard } from "@/components/cards";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
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
export const revalidate = 300;

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

  // Split featured handmade into hero card + rest
  const [heroHandmade, ...restHandmade] = data.featuredHandmade;
  // Split workshops into hero banner + rest
  const [heroWorkshop, ...restWorkshops] = data.upcomingWorkshops;
  // Split events into hero banner + rest
  const [heroEvent, ...restEvents] = data.upcomingEvents;

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

      {/* ─── Marketplace — featured hero + grid ─── */}
      <Section spacing="lg">
        <Container>
          <SectionHeader
            title="Marketplace"
            description="Ontdek handgemaakt werk van creators en materiaal van hobbywinkels."
          />

          {/* Handmade: 1 featured large + 3 regular */}
          <div className="mt-6">
            <SectionHeader subtle title="Uitgelicht handgemaakt" />
            {heroHandmade ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Featured large card spanning 2 cols */}
                <div className="md:col-span-2 md:row-span-2">
                  <ProductCard product={heroHandmade} className="h-full" />
                </div>
                {restHandmade.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <GridLayout cols={4}>
                {data.featuredHandmade.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </GridLayout>
            )}
          </div>

          {/* Supplies: standard grid */}
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

      {/* ─── Populaire domeinen — horizontal pills ─── */}
      <Section variant="alt" spacing="md">
        <Container>
          <SectionHeader title="Populaire domeinen" />
          <DomainPills domains={data.popularDomains} />
        </Container>
      </Section>

      {/* ─── CTA Banner — Word creator ─── */}
      <Section spacing="sm">
        <Container>
          <CTABanner
            title="Word creator op Hobbysalon"
            description="Verkoop je handgemaakt werk, geef workshops of deel je inspiratie met duizenden hobbyisten."
            href="/register"
            ctaText="Start als creator"
            variant="warm"
          />
        </Container>
      </Section>

      {/* ─── Aanbevelingen — warm highlight ─── */}
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

      {/* ─── Workshops — featured banner + cards ─── */}
      <Section spacing="md" divider>
        <Container>
          <SectionHeader title="Aankomende workshops" href="/workshops" />

          {heroWorkshop ? (
            <div className="space-y-6">
              {/* Full-width featured workshop banner */}
              <FeaturedBanner
                title={heroWorkshop.title}
                description={heroWorkshop.short_description ?? undefined}
                imageUrl={heroWorkshop.featured_image_url}
                imageFallback="placeholderWorkshop"
                href={`/workshop/${heroWorkshop.slug}`}
                badge={heroWorkshop.format_type === "online" ? "Online" : "Fysiek"}
                ctaText="Bekijk workshop"
                variant="warm"
              />

              {/* Remaining workshops in compact row */}
              {restWorkshops.length > 0 && (
                <GridLayout cols={3}>
                  {restWorkshops.map((workshop) => (
                    <WorkshopCard key={workshop.id} workshop={workshop} />
                  ))}
                </GridLayout>
              )}
            </div>
          ) : (
            <GridLayout cols={3}>
              {data.upcomingWorkshops.map((workshop) => (
                <WorkshopCard key={workshop.id} workshop={workshop} />
              ))}
            </GridLayout>
          )}
        </Container>
      </Section>

      {/* ─── Agenda — featured banner + cards ─── */}
      <Section variant="alt" spacing="md">
        <Container>
          <SectionHeader title="Agenda" href="/agenda" />

          {heroEvent ? (
            <div className="space-y-6">
              {/* Full-width featured event banner */}
              <FeaturedBanner
                title={heroEvent.title}
                description={heroEvent.short_description ?? undefined}
                imageUrl={heroEvent.featured_image_url}
                imageFallback="placeholderEvent"
                href={`/agenda/${heroEvent.slug}`}
                badge={heroEvent.city ?? undefined}
                ctaText="Bekijk event"
                variant="sage"
              />

              {/* Remaining events */}
              {restEvents.length > 0 && (
                <GridLayout cols={3}>
                  {restEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </GridLayout>
              )}
            </div>
          ) : (
            <GridLayout cols={3}>
              {data.upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </GridLayout>
          )}
        </Container>
      </Section>

      {/* ─── Artikelen — magazine layout ─── */}
      <Section spacing="md">
        <Container>
          <SectionHeader
            title="Inspiratieartikelen"
            href="/gratis-haakpatronen"
            linkText="Gratis NL haakpatronen"
          />
          <ArticleFeature articles={data.latestArticles} />
        </Container>
      </Section>

      {/* ─── CTA Banner — Start je hobby ─── */}
      <Section spacing="sm">
        <Container>
          <CTABanner
            title="Klaar om te starten?"
            description="Ontdek stap-voor-stap projecten, van beginners tot gevorderden. Alles wat je nodig hebt op één plek."
            href="/materials"
            ctaText="Bekijk projecten"
            variant="sage"
          />
        </Container>
      </Section>

      {/* ─── Projecten — standard grid ─── */}
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

      {/* ─── Creators — spotlight row ─── */}
      <Section spacing="lg" divider>
        <Container>
          <SectionHeader title="Creators van de maand" href="/creators" />
          <CreatorSpotlight creators={data.creatorsOfTheMonth} />
        </Container>
      </Section>
    </>
  );
}
