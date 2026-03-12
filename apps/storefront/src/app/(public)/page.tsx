import Link from "next/link";
import { getHomePageData } from "@/lib/services/home-page";
import { ProductCard, WorkshopCard, EventCard, ArticleCard, CreatorCard, ProjectCard } from "@/components/cards";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { CardShell } from "@/components/ui/card-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { GridLayout } from "@/components/layout/grid-layout";
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

  return (
    <Container className="py-12">
      <TrackOnMount
        event="home_recommendations_viewed"
        payload={{
          recommendation_source: data.recommendationSource,
          item_count: data.recommendedProjects.length,
          latency_ms: data.recommendationLatencyMs,
          user_id: data.viewerUserId,
        }}
      />
      <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
        Welkom bij Hobbysalon
      </h1>
      <p className="text-lg text-[var(--muted)] mb-8">
        Ontdek creatieve hobby&apos;s, makers, workshops, evenementen en inspiratie.
      </p>

      <section className="mb-10">
        <SectionHeader
          title={
            data.recommendationSource === "personalized"
              ? "Aanbevolen voor jou"
              : "Populaire projecten om te starten"
          }
          description={
            data.recommendationSource === "personalized"
              ? "Gebaseerd op je favorieten, domeingedrag en recente interacties."
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
            title="Nog geen aanbevelingen"
            description="Verken domeinen en markeer je favorieten om persoonlijke aanbevelingen te ontvangen."
          />
        )}
      </section>

      <SectionHeader title="Populaire domeinen" />
      <GridLayout cols={4}>
        {data.popularDomains.map((domain) => (
          <Link key={domain.id} href={`/${domain.slug}`} className="block">
            <CardShell variant="interactive" padding="md">
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

      <section className="mt-10">
        <SectionHeader title="Aankomende workshops" href="/workshops" />
        <GridLayout cols={3}>
          {data.upcomingWorkshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} />
          ))}
        </GridLayout>
      </section>

      <section className="mt-10">
        <SectionHeader title="Uitgelicht handgemaakt" />
        <GridLayout cols={4}>
          {data.featuredHandmade.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </GridLayout>
      </section>

      <section className="mt-10">
        <SectionHeader title="Uitgelichte benodigdheden" />
        <GridLayout cols={4}>
          {data.featuredSupplies.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </GridLayout>
      </section>

      <section className="mt-10">
        <SectionHeader title="Agenda teaser" href="/agenda" />
        <GridLayout cols={3}>
          {data.upcomingEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </GridLayout>
      </section>

      <section className="mt-10">
        <SectionHeader title="Inspiratieartikelen" />
        <GridLayout cols={3}>
          {data.latestArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </GridLayout>
      </section>

      <section className="mt-10">
        <SectionHeader title="Projecten om direct te starten" />
        <GridLayout cols={4}>
          {data.featuredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </GridLayout>
      </section>

      <section className="mt-10">
        <SectionHeader title="Creators van de maand" href="/creators" />
        <GridLayout cols={3}>
          {data.creatorsOfTheMonth.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} />
          ))}
        </GridLayout>
      </section>
    </Container>
  );
}
