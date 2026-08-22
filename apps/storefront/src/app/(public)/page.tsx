import type { Metadata } from "next";
import Link from "next/link";
import { HomeAgendaTeaser } from "@/components/home/HomeAgendaTeaser";
import { HomeDiscoverBlock } from "@/components/home/HomeDiscoverBlock";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeHobbyChips } from "@/components/home/HomeHobbyChips";
import { HomeJourneySection } from "@/components/home/HomeJourneySection";
import { HomeMakers } from "@/components/home/HomeMakers";
import { HomeProductRail } from "@/components/home/HomeProductRail";
import { HomeProvidersCta } from "@/components/home/HomeProvidersCta";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";
import {
  getHomePageData,
  homeWeekendAgendaHref,
} from "@/lib/services/home-page";
import { listResumableSavedProjects } from "@/lib/profile/resumable-saved-project-service";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Hobbysalon | Creatief platform voor België en Nederland",
  description:
    "Vind een creatief uitje, workshop, maker of stap-voor-stap project in België en Nederland.",
};

export default async function HomePage() {
  const data = await getHomePageData().catch(() => ({
    domainsWithLiveContent: [],
    featuredEvents: [],
    journey: null,
    upcomingWorkshops: [],
    homeMakeItems: [],
    makers: [],
    materials: [],
    makersmarkt: [],
  }));

  let resumableProject: Awaited<
    ReturnType<typeof listResumableSavedProjects>
  >[number] | null = null;
  try {
    const user = await getAuthUser();
    if (user?.id) {
      [resumableProject] = await listResumableSavedProjects(user.id);
    }
  } catch {
    resumableProject = null;
  }

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hobbysalon",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/logo.png"),
    description:
      "Creatief platform voor workshops, makers, hobbywinkels, evenementen en creatieve inspiratie in België en Nederland.",
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Hobbysalon",
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/zoeken?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };

  const heroImage =
    data.upcomingWorkshops.find((w) => w.featured_image_url?.trim())
      ?.featured_image_url ?? null;

  return (
    <>
      <JsonLd data={[orgSchema, websiteSchema]} />

      <HomeHero
        weekendHref={homeWeekendAgendaHref()}
        imageSrc={heroImage}
      />

      {resumableProject ? (
        <Container className="py-5">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                Verder met je project
              </p>
              <p className="mt-1 text-[15px] text-[var(--muted)]">
                {resumableProject.source.title}
              </p>
            </div>
            <Link
              href={`/profile/start/${resumableProject.entityType}/${resumableProject.entityId}`}
              className="inline-flex min-h-11 shrink-0 items-center font-bold text-[var(--accent)] underline underline-offset-4"
            >
              Ga verder
            </Link>
          </div>
        </Container>
      ) : null}

      <div className="border-b border-[var(--border)] bg-[var(--section-alt)]">
        <Container className="py-8 sm:py-10">
          <HomeHobbyChips domains={data.domainsWithLiveContent} />
        </Container>
      </div>

      <Container className="flex flex-col gap-14 py-10 sm:gap-16 sm:py-14">
        <HomeAgendaTeaser events={data.featuredEvents} />

        {data.journey ? <HomeJourneySection journey={data.journey} /> : null}

        <HomeDiscoverBlock
          workshops={data.upcomingWorkshops}
          makeItems={data.homeMakeItems}
        />

        <HomeProductRail
          title="Materialen voor je project"
          lead="Wol, papier, klei en meer van hobbywinkels in België en Nederland."
          href="/materials"
          ctaLabel="Alle materialen"
          products={data.materials}
        />

        <HomeProductRail
          title="Rechtstreeks van makers"
          lead="Handgemaakte creaties en restanten. Kies iets unieks of vraag de maker."
          href="/creators"
          ctaLabel="Naar de makersmarkt"
          products={data.makersmarkt}
        />

        <HomeMakers makers={data.makers} />
      </Container>

      <HomeProvidersCta />
    </>
  );
}
