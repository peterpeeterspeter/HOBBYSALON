import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  Search,
  Store,
  Users,
} from "lucide-react";
import { getHomePageData } from "@/lib/services/home-page";
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
  title: "Hobbysalon | Creatief platform voor workshops, makers en inspiratie",
  description:
    "Ontdek workshops, makers, hobbywinkels, evenementen, materialen en creatieve inspiratie in België en Nederland.",
  path: "/",
});
export const revalidate = 300;

const CREATOR_TYPE_LABELS: Record<string, string> = {
  maker: "Maker",
  workshopgever: "Workshopgever",
  supplier: "Leverancier",
  content_creator: "Contentmaker",
  organizer: "Organisator",
};

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  tutorial: "Tutorial",
  guide: "Gids",
  inspiration: "Inspiratie",
  interview: "Interview",
  pattern: "Patroon",
};

const HERO_VISUALS = [
  {
    title: "Keramiek workshop",
    meta: "Gent, volgende maand",
    label: "Workshops",
    icon: CalendarDays,
  },
  {
    title: "Wol, garen en materiaal",
    meta: "Lokale hobbywinkels",
    label: "Materialen",
    icon: Store,
  },
  {
    title: "Makers market",
    meta: "Antwerpen en Breda",
    label: "Makers",
    icon: Users,
  },
];

const PLATFORM_PILLARS = [
  {
    title: "Workshops boeken",
    body: "Vind creatieve lessen in je buurt en reserveer bij betrouwbare workshopgevers.",
    href: "/workshops",
    icon: CalendarDays,
  },
  {
    title: "Makers ontdekken",
    body: "Volg keramisten, illustratoren, textielkunstenaars en kleine ateliers.",
    href: "/creators",
    icon: Users,
  },
  {
    title: "Winkels vinden",
    body: "Ontdek lokale hobbywinkels, materialen, producten en nieuws uit de regio.",
    href: "/materials",
    icon: Store,
  },
  {
    title: "Leren en maken",
    body: "Lees handleidingen, patronen, gidsen en materiaalreviews voor je volgende project.",
    href: "/gratis-haakpatronen",
    icon: BookOpen,
  },
];

const AUDIENCES = [
  {
    title: "Voor bezoekers",
    body: "Een centrale plek voor workshops, winkels, makers, evenementen en inspiratie.",
    href: "/workshops",
    cta: "Ontdek aanbod",
  },
  {
    title: "Voor workshopgevers",
    body: "Een professioneel profiel, online reservaties, reviews en vindbaarheid via Google.",
    href: "/voor-workshopgevers",
    cta: "Word aanbieder",
  },
  {
    title: "Voor winkels",
    body: "Een digitale etalage voor producten, workshops, evenementen, nieuws en webshopverkeer.",
    href: "/voor-winkels",
    cta: "Toon je winkel",
  },
  {
    title: "Voor organisatoren",
    body: "Promoot hobbybeurzen, creatieve evenementen en makers markets in één centrale agenda.",
    href: "/voor-organisatoren",
    cta: "Promoot event",
  },
];

const GRAPH_EXAMPLES = [
  "Macramé workshops in Antwerpen",
  "Haakworkshops voor beginners",
  "Keramiek workshops in Limburg",
  "Hobbywinkels voor scrapbooking",
  "Workshops met wol",
  "Makers markets dit weekend",
];

const FALLBACK_HOME_DATA: Awaited<ReturnType<typeof getHomePageData>> = {
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
        className="flex min-h-full flex-col items-start gap-4 rounded-[1.5rem] p-5"
      >
        <Avatar src={creator.avatar_url} alt={creator.display_name} size="xl" />
        <div>
          <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
            {creator.display_name}
          </p>
          {badgeLabel && (
            <div className="mt-2">
              <Badge variant="domain">{badgeLabel}</Badge>
            </div>
          )}
          {creator.workshop_count > 0 && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {creator.workshop_count} workshop{creator.workshop_count === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </CardShell>
    </Link>
  );
}

function HeroSection({ domainCount }: { domainCount: number }) {
  return (
    <section className="relative overflow-hidden bg-[var(--hero-bg)] py-10 md:py-14 lg:py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(226,126,74,0.18),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(51,116,88,0.14),transparent_28%)]" aria-hidden="true" />
      <Container size="wide" className="relative grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--card)] px-4 py-2 text-sm font-bold text-[var(--accent)] shadow-[var(--shadow-sm)]">
            Creatief platform voor België en Nederland
          </p>
          <h1 className="max-w-[12ch] font-display text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[var(--foreground)] sm:text-6xl lg:text-7xl">
            Alles voor creatieve hobby&apos;s.
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-relaxed text-[var(--muted)]">
            Vind workshops, makers, winkels, evenementen en inspiratie op één verbonden platform.
          </p>

          <form action="/zoeken" role="search" className="mt-7 max-w-2xl">
            <label htmlFor="home-search" className="sr-only">
              Zoek workshops, makers, winkels of inspiratie
            </label>
            <div className="flex flex-col gap-3 rounded-[1.4rem] border border-[var(--border-strong)] bg-[var(--card)] p-2 shadow-[var(--shadow-lg)] sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={22}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]"
                />
                <input
                  id="home-search"
                  type="search"
                  name="q"
                  placeholder="Zoek bijvoorbeeld keramiek, haken of Gent"
                  className="min-h-[58px] w-full rounded-[1rem] bg-transparent pl-12 pr-4 text-lg text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]/70"
                />
              </div>
              <button
                type="submit"
                className="min-h-[58px] whitespace-nowrap rounded-[1rem] bg-[var(--accent)] px-7 text-base font-black text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] active:translate-y-px"
              >
                Zoek
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="home-primary-cta" href="/workshops">
              Vind workshops
            </Link>
            <Link className="home-secondary-cta" href="/voor-workshopgevers">
              Word aanbieder
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[0.82fr_1fr]">
          <div className="space-y-4 sm:pt-12">
            {HERO_VISUALS.slice(1).map((visual) => {
              const Icon = visual.icon;
              return (
                <div key={visual.title} className="home-visual-card home-visual-card-small">
                  <span>{visual.label}</span>
                  <Icon size={32} aria-hidden="true" />
                  <h3>{visual.title}</h3>
                  <p>{visual.meta}</p>
                </div>
              );
            })}
          </div>
          <div className="home-visual-card home-visual-card-large">
            {(() => {
              const visual = HERO_VISUALS[0];
              const Icon = visual.icon;
              return (
                <>
                  <span>{domainCount > 0 ? `${domainCount} hobbywerelden` : "365 dagen creatief"}</span>
                  <Icon size={46} aria-hidden="true" />
                  <h3>{visual.title}</h3>
                  <p>{visual.meta}</p>
                </>
              );
            })()}
          </div>
        </div>
      </Container>
    </section>
  );
}

function PlatformPillars() {
  return (
    <Section spacing="lg" className="home-section-grid">
      <Container size="wide">
        <div className="max-w-3xl">
          <h2 className="home-section-title">Van beurs naar dagelijks platform</h2>
          <p className="home-section-copy">
            Hobbysalon verbindt de volledige creatieve hobbywereld: inspiratie, aanbieders, activiteiten, winkels en evenementen.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLATFORM_PILLARS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="home-pillar-card">
                <span className="home-icon-box"><Icon size={24} aria-hidden="true" /></span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </Link>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

function AudienceSection() {
  return (
    <Section spacing="lg" variant="alt">
      <Container size="wide">
        <div className="home-audience-layout">
          <div>
            <h2 className="home-section-title">Eén ingang voor elke creatieve rol</h2>
            <p className="home-section-copy">
              Bezoekers zoeken inspiratie. Aanbieders zoeken zichtbaarheid. De nieuwe Hobbysalon brengt die vraag en dat aanbod samen.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {AUDIENCES.map((item) => (
              <CardShell key={item.title} variant="default" padding="lg" className="home-audience-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <Link href={item.href}>{item.cta}</Link>
              </CardShell>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

function GraphSection() {
  return (
    <Section spacing="lg" className="overflow-hidden">
      <Container size="wide">
        <div className="home-graph-card">
          <div className="max-w-2xl">
            <span className="home-kicker">De kennislaag</span>
            <h2 className="home-graph-title">De graph maakt zoeken slimmer.</h2>
            <p>
              Workshops, makers, winkels, materialen, artikelen, technieken en steden worden als relaties opgeslagen. Zo ontstaan betere zoekresultaten, aanbevelingen en SEO-pagina&apos;s.
            </p>
          </div>
          <div className="home-graph-cluster" aria-label="Voorbeelden van graph-gedreven pagina&apos;s">
            {GRAPH_EXAMPLES.map((example) => (
              <span key={example}>{example}</span>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

function EmptyPlatformPreview() {
  return (
    <Section spacing="md" variant="highlight">
      <Container>
        <div className="home-empty-preview">
          <div>
            <h2>Platform wordt geladen</h2>
            <p>
              Zodra de databank beschikbaar is, verschijnen hier workshops, makers, producten, evenementen en inspiratie uit de graph.
            </p>
          </div>
          <Link href="/register">Word aanbieder</Link>
        </div>
      </Container>
    </Section>
  );
}

export default async function HomePage() {
  let data: Awaited<ReturnType<typeof getHomePageData>> = FALLBACK_HOME_DATA;

  try {
    data = await getHomePageData();
  } catch {
    data = FALLBACK_HOME_DATA;
  }

  const hasLiveSections =
    data.upcomingWorkshops.length > 0 ||
    data.featuredHandmade.length > 0 ||
    data.featuredSupplies.length > 0 ||
    data.upcomingEvents.length > 0 ||
    data.latestArticles.length > 0 ||
    data.creatorsOfTheMonth.length > 0 ||
    data.featuredProjects.length > 0;

  return (
    <>
      <TrackOnMount
        event="home_recommendations_viewed"
        payload={{
          recommendation_source: data.recommendationSource,
          item_count: data.recommendedProjects.length,
          latency_ms: data.recommendationLatencyMs,
          user_id: data.viewerUserId,
        }}
      />

      <HeroSection domainCount={data.popularDomains.length} />
      <PlatformPillars />
      <AudienceSection />
      <GraphSection />

      {data.popularDomains.length > 0 && (
        <Section spacing="sm" className="border-y border-[var(--border)] bg-[var(--card)]">
          <Container size="wide">
            <div className="flex gap-3 overflow-x-auto py-1 scrollbar-hide">
              {data.popularDomains.slice(0, 10).map((domain) => (
                <Link key={domain.id} href={`/${domain.slug}`} className="home-domain-chip">
                  {domain.name}
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      )}

      {!hasLiveSections && <EmptyPlatformPreview />}

      {data.upcomingWorkshops.length > 0 && (
        <Section spacing="lg">
          <Container size="wide">
            <SectionHeader
              title="Aankomende workshops"
              description="Leer een techniek bij een maker, atelier of hobbywinkel in je buurt."
              href="/workshops"
              linkText="Bekijk workshops"
            />
            <GridLayout cols={4} gap="md">
              {data.upcomingWorkshops.slice(0, 4).map((workshop) => (
                <WorkshopCard key={workshop.id} workshop={workshop} />
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {(data.featuredHandmade.length > 0 || data.featuredSupplies.length > 0) && (
        <Section variant="alt" spacing="lg">
          <Container size="wide">
            <SectionHeader
              title="Materialen en handgemaakt werk"
              description="Koop bij kleine aanbieders en ontdek materialen die passen bij je volgende project."
              href="/materials"
              linkText="Bekijk materialen"
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

      {data.creatorsOfTheMonth.length > 0 && (
        <Section spacing="lg">
          <Container size="wide">
            <SectionHeader
              title="Makers en workshopgevers"
              description="Ontdek de mensen achter ateliers, cursussen, patronen en handgemaakte producten."
              href="/creators"
              linkText="Bekijk makers"
            />
            <GridLayout cols={4} gap="md">
              {data.creatorsOfTheMonth.slice(0, 4).map((creator) => (
                <CreatorFeatureCard key={creator.id} creator={creator} />
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {data.upcomingEvents.length > 0 && (
        <Section variant="alt" spacing="lg">
          <Container size="wide">
            <SectionHeader
              title="Agenda voor creatief België en Nederland"
              description="Hobbybeurzen, makers markets, open ateliers en creatieve evenementen op één plek."
              href="/agenda"
              linkText="Bekijk agenda"
            />
            <GridLayout cols={3} gap="md">
              {data.upcomingEvents.slice(0, 3).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {data.latestArticles.length > 0 && (
        <Section spacing="lg">
          <Container size="wide">
            <SectionHeader
              title="Inspiratie als groeimotor"
              description="Tutorials, patronen, gidsen, interviews en materiaalreviews brengen elke dag nieuwe bezoekers naar Hobbysalon."
              href="/gratis-haakpatronen"
              linkText="Lees inspiratie"
            />
            <div className="grid gap-5 md:grid-cols-3">
              {data.latestArticles.slice(0, 3).map((article) => (
                <Link key={article.id} href={`/artikel/${article.slug}`} className="group/article block">
                  <CardShell variant="interactive" padding="none" className="home-article-card">
                    {article.featured_image_url && (
                      <img
                        src={article.featured_image_url}
                        alt=""
                        className="aspect-video w-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="p-5">
                      <p className="text-sm font-bold text-[var(--accent)]">
                        {ARTICLE_TYPE_LABELS[article.article_type] ?? article.article_type}
                        {article.reading_time_minutes ? `, ${article.reading_time_minutes} min lezen` : ""}
                      </p>
                      <h3 className="mt-2 font-[family-name:var(--font-heading)] text-xl font-bold leading-snug text-[var(--foreground)] line-clamp-2">
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

      {data.recommendedProjects.length > 0 && (
        <Section variant="highlight" spacing="lg">
          <Container size="wide">
            <SectionHeader
              title={
                data.recommendationSource === "personalized"
                  ? "Aanbevolen voor jou"
                  : "Projecten om direct te starten"
              }
              description={
                data.recommendationSource === "personalized"
                  ? "Gebaseerd op je interesses, favorieten en recente interacties."
                  : "Populaire projecten uit de community, klaar om zelf te maken."
              }
            />
            <GridLayout cols={3}>
              {data.recommendedProjects.map((item) => (
                <div key={item.project.id} className="space-y-2">
                  <ProjectCard project={item.project} />
                  <p className="text-sm text-[var(--muted)]">
                    {item.reasons[0] ?? "Aanbevolen project"}
                  </p>
                </div>
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      {data.featuredProjects.length > 0 && (
        <Section variant="alt" spacing="lg">
          <Container size="wide">
            <SectionHeader title="Uitgelichte projecten" />
            <GridLayout cols={4}>
              {data.featuredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      <section className="home-final-cta">
        <Container size="wide" className="home-final-cta-inner">
          <div>
            <span className="home-kicker">365 dagen community</span>
            <h2>Maak van Hobbysalon je creatieve thuisbasis.</h2>
            <p>
              Bouw bereik op via workshops, profielen, content, events en de fysieke beurzen die de community samenbrengen.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Link href="/voor-workshopgevers" className="home-primary-cta home-primary-cta-light">
              Word aanbieder
            </Link>
            <Link href="/agenda" className="home-secondary-cta home-secondary-cta-light">
              Bekijk agenda
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
