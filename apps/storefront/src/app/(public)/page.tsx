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
import { GridLayout } from "@/components/layout/grid-layout";
import { Section } from "@/components/layout/section";
import { buildPageMetadata } from "@/lib/seo";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import Link from "next/link";

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

  const [heroWorkshop, ...restWorkshops] = data.upcomingWorkshops;
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

      {/* ─── Marketplace ─── */}
      {(data.featuredHandmade.length > 0 || data.featuredSupplies.length > 0) && (
        <Section spacing="lg">
          <Container>
            <SectionHeader
              title="Marketplace"
              description="Ontdek handgemaakt werk van creators en materiaal van hobbywinkels."
              href="/materials"
              linkText="Naar de marketplace"
            />

            {data.featuredHandmade.length > 0 && (
              <div className="mt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--muted)]">
                    Uitgelicht handgemaakt
                  </h3>
                </div>
                <GridLayout cols={4} gap="md">
                  {data.featuredHandmade.slice(0, 4).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </GridLayout>
              </div>
            )}

            {data.featuredSupplies.length > 0 && (
              <div className="mt-10">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--muted)]">
                    Uitgelichte benodigdheden
                  </h3>
                  <Link
                    href="/materials"
                    className="text-sm font-semibold text-[var(--accent)] hover:underline"
                  >
                    Naar materials marketplace →
                  </Link>
                </div>
                <GridLayout cols={4} gap="md">
                  {data.featuredSupplies.slice(0, 4).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </GridLayout>
              </div>
            )}
          </Container>
        </Section>
      )}

      {/* ─── Populaire domeinen ─── */}
      {data.popularDomains.length > 0 && (
        <Section variant="alt" spacing="md">
          <Container>
            <SectionHeader title="Populaire domeinen" />
            <DomainPills domains={data.popularDomains} />
          </Container>
        </Section>
      )}

      {/* ─── CTA — Word creator ─── */}
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

      {/* ─── Aanbevelingen — only when personalised or cold-start has data ─── */}
      {data.recommendedProjects.length > 0 && (
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
                  ? "Gebaseerd op je profielinteresses, favorieten en recente interacties."
                  : "Gebaseerd op domeinpopulariteit en actuele activiteit op Hobbysalon."
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

      {/* ─── Workshops ─── */}
      {data.upcomingWorkshops.length > 0 && (
        <Section spacing="md" divider>
          <Container>
            <SectionHeader title="Aankomende workshops" href="/workshops" />
            {heroWorkshop ? (
              <div className="space-y-6">
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
      )}

      {/* ─── Agenda ─── */}
      {data.upcomingEvents.length > 0 && (
        <Section variant="alt" spacing="md">
          <Container>
            <SectionHeader title="Agenda" href="/agenda" />
            {heroEvent ? (
              <div className="space-y-6">
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
      )}

      {/* ─── Artikelen ─── */}
      {data.latestArticles.length > 0 && (
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
      )}

      {/* ─── CTA — Klaar om te starten ─── */}
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

      {/* ─── Projecten ─── */}
      {data.featuredProjects.length > 0 && (
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
      )}

      {/* ─── Creators van de maand ─── */}
      {data.creatorsOfTheMonth.length > 0 && (
        <Section spacing="lg" divider>
          <Container>
            <SectionHeader title="Creators van de maand" href="/creators" />
            <CreatorSpotlight creators={data.creatorsOfTheMonth} />
          </Container>
        </Section>
      )}
    </>
  );
}
