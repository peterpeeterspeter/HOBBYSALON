import type { Metadata } from "next";
import Link from "next/link";
import { HomeAgendaTeaser } from "@/components/home/HomeAgendaTeaser";
import { HomeDiscoverBlock } from "@/components/home/HomeDiscoverBlock";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeHobbyChips } from "@/components/home/HomeHobbyChips";
import { HomeJourneySection } from "@/components/home/HomeJourneySection";
import { HomeMakers } from "@/components/home/HomeMakers";
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
  }));

  // Auth-dependent resume stays outside the shared home cache
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

  return (
    <>
      <JsonLd data={[orgSchema, websiteSchema]} />

      <Container className="py-8 sm:py-10">
        <HomeHero weekendHref={homeWeekendAgendaHref()} />

        {resumableProject ? (
          <div className="mb-8 rounded-[12px] border border-[var(--border)] bg-[var(--section-highlight)] px-4 py-4 sm:px-5">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">
              Verder met je project
            </p>
            <p className="mt-1 text-[15px] text-[var(--muted)]">
              {resumableProject.source.title}
            </p>
            <Link
              href={`/profile/start/${resumableProject.entityType}/${resumableProject.entityId}`}
              className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
            >
              Ga verder
            </Link>
          </div>
        ) : null}

        <HomeHobbyChips domains={data.domainsWithLiveContent} />

        <HomeAgendaTeaser events={data.featuredEvents} />

        {data.journey ? <HomeJourneySection journey={data.journey} /> : null}

        <HomeDiscoverBlock
          workshops={data.upcomingWorkshops}
          makeItems={data.homeMakeItems}
        />

        <HomeMakers makers={data.makers} />

        <HomeProvidersCta />
      </Container>
    </>
  );
}
