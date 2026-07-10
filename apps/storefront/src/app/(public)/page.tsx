import Image from "next/image";
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
<<<<<<< HEAD
  title: "Hobbysalon — Creatieve hobby's, workshops & handgemaakt",
  description:
    "Sinds de jaren '90 dé plek voor creatieve hobbyisten in België en Nederland. Ontdek workshops, gratis patronen, handgemaakte producten en een community van 50.000+ makers.",
=======
  title: "Hobbysalon | Creatief platform voor workshops, makers en inspiratie",
  description:
    "Ontdek workshops, makers, hobbywinkels, evenementen, materialen en creatieve inspiratie in België en Nederland.",
>>>>>>> 8efe3afa3030fd1ea4ae20762fbdd2410eae6f3d
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
    title: "Leer iets nieuws",
    body: "Boek een keramiekles, haakworkshop of creatieve dag bij mensen die hun vak met plezier delen.",
    image: "/landing/workshop.jpg",
    alt: "Deelnemers tijdens een gezellige keramiekworkshop",
    href: "/workshops",
    icon: CalendarDays,
  },
  {
    title: "Vind je materiaal",
    body: "Ontdek wol, klei, papier, kits en mooie vondsten van winkels en makers uit de buurt.",
    image: "/landing/crafts-grid.jpg",
    alt: "Handgemaakte keramiek, wol en macramé materiaal op tafel",
    href: "/materials",
    icon: Store,
  },
  {
    title: "Ga eropuit",
    body: "Plan een makers market, beurs of open atelier waar je inspiratie mee naar huis neemt.",
    image: "/landing/products/event-ambachtsmarkt-gent.jpg",
    alt: "Ambachtsmarkt met creatieve standen en bezoekers",
    href: "/agenda",
    icon: Users,
  },
];

const PLATFORM_PILLARS = [
  {
    title: "Kies een workshop",
    body: "Van een eerste haaksteek tot een avond keramiek: vind een plek waar je meteen zin van krijgt.",
    href: "/workshops",
    image: "/landing/products/workshop-handvormen-klei.jpg",
    alt: "Handen die klei vormen tijdens een creatieve workshop",
    icon: CalendarDays,
  },
  {
    title: "Ontmoet makers",
    body: "Volg ateliers, ontwerpers en creatieve ondernemers die hun werk en kennis met je delen.",
    href: "/creators",
    image: "/landing/placeholder-creator.jpg",
    alt: "Creatieve maker in een warm atelier",
    icon: Users,
  },
  {
    title: "Shop lokaal",
    body: "Vind hobbywinkels en materialen die passen bij wat jij vandaag of dit weekend wil maken.",
    href: "/materials",
    image: "/landing/products/wolpakket-merino.jpg",
    alt: "Zachte bollen merinowol in warme kleuren",
    icon: Store,
  },
  {
    title: "Laat je inspireren",
    body: "Bewaar patronen, lees gidsen en ontdek technieken die je stap voor stap verder helpen.",
    href: "/gratis-haakpatronen",
    image: "/landing/hero.jpg",
    alt: "Lichte hobbytafel met wol, verf en keramiek",
    icon: BookOpen,
  },
];

const AUDIENCES = [
  {
    title: "Ik zoek iets om te doen",
    body: "Bekijk workshops, winkels en evenementen zonder zelf tientallen websites af te gaan.",
    href: "/workshops",
    cta: "Vind iets leuks",
  },
  {
    title: "Ik geef workshops",
    body: "Laat zien wat je organiseert, ontvang aanvragen en bouw vertrouwen op met je profiel.",
    href: "/voor-workshopgevers",
    cta: "Word aanbieder",
  },
  {
    title: "Ik heb een hobbywinkel",
    body: "Breng je winkel, materialen, lessen en nieuws onder de aandacht van creatieve klanten.",
    href: "/voor-winkels",
    cta: "Toon je winkel",
  },
  {
    title: "Ik organiseer een event",
    body: "Zet je beurs, markt of open atelier in de agenda waar hobbyisten actief zoeken.",
    href: "/voor-organisatoren",
    cta: "Promoot je event",
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
            Waar creatieve plannen beginnen.
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-relaxed text-[var(--muted)]">
            Ontdek wat je kunt maken, leren en bezoeken in België en Nederland.
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
              Zoek inspiratie
            </Link>
            <Link className="home-secondary-cta" href="/voor-workshopgevers">
              Word aanbieder
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[0.82fr_1fr]">
          <div className="space-y-4 sm:pt-10">
            {HERO_VISUALS.slice(1).map((visual) => {
              const Icon = visual.icon;
              return (
                <Link key={visual.title} href={visual.href} className="home-photo-card home-photo-card-small">
                  <Image src={visual.image} alt={visual.alt} fill sizes="(min-width: 1024px) 260px, 50vw" className="object-cover" />
                  <div className="home-photo-card-copy">
                    <Icon size={24} aria-hidden="true" />
                    <h3>{visual.title}</h3>
                    <p>{visual.body}</p>
                  </div>
                </Link>
              );
            })}
          </div>
          <Link href={HERO_VISUALS[0].href} className="home-photo-card home-photo-card-large">
            <Image
              src={HERO_VISUALS[0].image}
              alt={HERO_VISUALS[0].alt}
              fill
              priority
              sizes="(min-width: 1024px) 340px, 100vw"
              className="object-cover"
            />
            <div className="home-photo-card-copy">
              <CalendarDays size={30} aria-hidden="true" />
              <h3>{HERO_VISUALS[0].title}</h3>
              <p>{HERO_VISUALS[0].body}</p>
              <span>{domainCount > 0 ? `${domainCount} hobbywerelden` : "365 dagen Hobbysalon"}</span>
            </div>
          </Link>
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
          <h2 className="home-section-title">Niet wachten tot de volgende beurs.</h2>
          <p className="home-section-copy">
            Hobbysalon helpt je het hele jaar door iets nieuws te leren, een maker te volgen of een gezellig creatief uitje te plannen.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLATFORM_PILLARS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="home-pillar-card">
                <div className="home-pillar-image">
                  <Image src={item.image} alt={item.alt} fill sizes="(min-width: 1280px) 280px, (min-width: 768px) 45vw, 100vw" className="object-cover" />
                </div>
                <div className="home-pillar-content">
                  <span className="home-icon-box"><Icon size={24} aria-hidden="true" /></span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
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
            <h2 className="home-section-title">Iedereen vindt zijn plek.</h2>
            <p className="home-section-copy">
              Hobbyisten komen om te ontdekken. Makers, winkels en organisatoren krijgen een plek waar ze gevonden worden.
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
            <span className="home-kicker">Slimmer ontdekken</span>
            <h2 className="home-graph-title">Van één idee naar alles wat erbij past.</h2>
            <p>
              Zoek je naar macramé, keramiek of haken? Dan brengt Hobbysalon workshops, materialen, winkels, makers en artikels vanzelf dichter bij elkaar.
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
            <h2>Binnenkort meer inspiratie</h2>
            <p>
              We vullen Hobbysalon met workshops, makers, winkels, evenementen en artikels. Wil je zichtbaar zijn vanaf de start?
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
<<<<<<< HEAD
      <h1 className="sr-only">Hobbysalon — Dé creatieve community voor hobbyisten in België en Nederland</h1>
      <p className="sr-only">
        Sinds de jaren &apos;90 brengen we creatieve mensen samen. Ontdek gratis patronen,
        workshops bij jou in de buurt, handgemaakte producten en duizenden inspirerende artikelen.
      </p>

      {/* ─── Marketplace — featured hero + grid ─── */}
      <Section spacing="lg">
        <Container>
          <SectionHeader
            title="Handgemaakt & materialen"
            description="Van makers uit België en Nederland — direct te bestellen of op te halen."
          />

          {/* Handmade: 1 featured large + 3 regular */}
          <div className="mt-6">
            <SectionHeader subtle title="Uitgelicht handgemaakt werk" />
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
=======

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
>>>>>>> 8efe3afa3030fd1ea4ae20762fbdd2410eae6f3d

      {!hasLiveSections && <EmptyPlatformPreview />}

      {data.upcomingWorkshops.length > 0 && (
        <Section spacing="lg">
          <Container size="wide">
            <SectionHeader
<<<<<<< HEAD
              subtle
              title="Benodigdheden & garen"
              href="/materials"
              linkText="Bekijk alle materialen"
=======
              title="Workshops waar je zin van krijgt"
              description="Kies een les, schuif aan tafel en ga naar huis met iets dat je zelf maakte."
              href="/workshops"
              linkText="Bekijk workshops"
>>>>>>> 8efe3afa3030fd1ea4ae20762fbdd2410eae6f3d
            />
            <GridLayout cols={4} gap="md">
              {data.upcomingWorkshops.slice(0, 4).map((workshop) => (
                <WorkshopCard key={workshop.id} workshop={workshop} />
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

<<<<<<< HEAD
      {/* ─── Populaire domeinen — horizontal pills ─── */}
      <Section variant="alt" spacing="md">
        <Container>
          <SectionHeader title="Kies je hobby" />
          <DomainPills domains={data.popularDomains} />
        </Container>
      </Section>

      {/* ─── CTA Banner — Word creator ─── */}
      <Section spacing="sm">
        <Container>
          <CTABanner
            title="Word creator op Hobbysalon"
            description="Verkoop je handgemaakte werk, geef workshops of deel je patronen met onze community van 50.000+ hobbyisten."
            href="/register"
            ctaText="Gratis starten"
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
                : "Populair bij onze community"
            }
            description={
              data.recommendationSource === "personalized"
                ? "Gebaseerd op je favorieten en interesses."
                : "De projecten waar nu het meest mee gestart wordt."
            }
          />
          {data.recommendedProjects.length > 0 ? (
=======
      {(data.featuredHandmade.length > 0 || data.featuredSupplies.length > 0) && (
        <Section variant="alt" spacing="lg">
          <Container size="wide">
            <SectionHeader
              title="Mooie materialen en vondsten"
              description="Alles voor je volgende project, van garen en klei tot handgemaakte stukken met een verhaal."
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
              title="De mensen achter het werk"
              description="Maak kennis met ateliers, ontwerpers en lesgevers die de creatieve wereld dichterbij brengen."
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
              title="Een agenda vol creatieve uitstappen"
              description="Plan je volgende beurs, makers market, open atelier of workshopdag."
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
              title="Inspiratie voor thuis aan tafel"
              description="Patronen, gidsen en verhalen die je helpen kiezen wat je straks wil maken."
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
                  ? "Iets voor jou"
                  : "Projecten om mee te beginnen"
              }
              description={
                data.recommendationSource === "personalized"
                  ? "Gekozen op basis van wat je bekijkt, bewaart en graag maakt."
                  : "Laagdrempelige ideeën uit de community om meteen mee aan de slag te gaan."
              }
            />
>>>>>>> 8efe3afa3030fd1ea4ae20762fbdd2410eae6f3d
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
<<<<<<< HEAD
          ) : (
            <EmptyState
              compact
              title="Nog geen aanbevelingen"
              description="Maak een account aan en markeer je favorieten voor persoonlijke tips."
            />
          )}
        </Container>
      </Section>

      {/* ─── Workshops — featured banner + cards ─── */}
      <Section spacing="md" divider>
        <Container>
          <SectionHeader title="Workshops bij jou in de buurt" href="/workshops" />

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
=======
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
>>>>>>> 8efe3afa3030fd1ea4ae20762fbdd2410eae6f3d
              ))}
            </GridLayout>
          </Container>
        </Section>
      )}

      <section className="home-final-cta">
        <Container size="wide" className="home-final-cta-inner">
          <div>
            <span className="home-kicker">Voor aanbieders</span>
            <h2>Laat creatieve mensen je makkelijker vinden.</h2>
            <p>
              Geef workshops, toon je winkel, promoot je event of deel je verhaal met de Hobbysalon-community.
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
<<<<<<< HEAD
      </Section>

      {/* ─── Agenda — featured banner + cards ─── */}
      <Section variant="alt" spacing="md">
        <Container>
          <SectionHeader title="Evenementen & beurzen" href="/agenda" />

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
            title="Inspiratie & gratis patronen"
            href="/gratis-haakpatronen"
            linkText="Alle gratis patronen"
          />
          <ArticleFeature articles={data.latestArticles} />
        </Container>
      </Section>

      {/* ─── CTA Banner — Start je hobby ─── */}
      <Section spacing="sm">
        <Container>
          <CTABanner
            title="Klaar om iets te maken?"
            description="Ontdek stap-voor-stap patronen en projecten — van beginner tot expert. Inclusief garenlijst en video-uitleg."
            href="/materials"
            ctaText="Start een project"
            variant="sage"
          />
        </Container>
      </Section>

      {/* ─── Projecten — standard grid ─── */}
      <Section variant="alt" spacing="md">
        <Container>
          <SectionHeader title="Projecten om nu te beginnen" />
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
          <SectionHeader title="Makers in de spotlight" href="/creators" />
          <CreatorSpotlight creators={data.creatorsOfTheMonth} />
        </Container>
      </Section>
=======
      </section>
>>>>>>> 8efe3afa3030fd1ea4ae20762fbdd2410eae6f3d
    </>
  );
}
