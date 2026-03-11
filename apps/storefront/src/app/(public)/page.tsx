import Link from "next/link";
import { getHomePageData } from "@/lib/services/home-page";
import { WorkshopCard } from "@/components/shared/WorkshopCard";
import { ProductCard } from "@/components/shared/ProductCard";
import { EventCard } from "@/components/shared/EventCard";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { CreatorCard } from "@/components/shared/CreatorCard";
import { ProjectCard } from "@/components/shared/ProjectCard";
import { buildPageMetadata } from "@/lib/seo";

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
  };

  try {
    data = await getHomePageData();
  } catch {
    // Platform DB not configured or unavailable
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
        Welkom bij Hobbysalon
      </h1>
      <p className="text-lg text-[var(--muted)] mb-8">
        Ontdek creatieve hobby&apos;s, makers, workshops, evenementen en inspiratie.
      </p>

      <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Populaire domeinen</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.popularDomains.map((domain) => (
          <Link
            key={domain.id}
            href={`/${domain.slug}`}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--accent)]"
          >
            <h3 className="font-semibold text-[var(--foreground)]">{domain.name}</h3>
            {domain.short_description && (
              <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                {domain.short_description}
              </p>
            )}
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Aankomende workshops</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.upcomingWorkshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Uitgelicht handgemaakt</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.featuredHandmade.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Uitgelichte benodigdheden</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.featuredSupplies.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Agenda teaser</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.upcomingEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Inspiratieartikelen</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.latestArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Projecten om direct te starten</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.featuredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">Creators van de maand</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.creatorsOfTheMonth.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} />
          ))}
        </div>
      </section>
    </div>
  );
}
