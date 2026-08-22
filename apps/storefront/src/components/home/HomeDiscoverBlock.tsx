import Link from "next/link";
import { DifficultyIndicator } from "@/components/domain/difficulty-indicator";
import { DateDisplay } from "@/components/domain/date-display";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import type { HomeMakeItem } from "@/lib/services/home-page";
import type { WorkshopDiscoveryItem } from "@/lib/platform/queries/workshops";
import { HomeReveal } from "./HomeReveal";

type HomeDiscoverBlockProps = {
  workshops: WorkshopDiscoveryItem[];
  makeItems: HomeMakeItem[];
};

function placeOrOnlineLabel(item: WorkshopDiscoveryItem): string {
  if (item.format_type === "online") return "Online";
  return item.city?.trim() || item.location_name?.trim() || "Locatie volgt";
}

function MakeListRow({ item }: { item: HomeMakeItem }) {
  const entity = item.item;
  const href =
    item.kind === "article"
      ? `/artikel/${entity.slug}`
      : `/project/${entity.slug}`;
  const image = entity.featured_image_url;
  const duration =
    item.kind === "article"
      ? item.item.reading_time_minutes
        ? `${item.item.reading_time_minutes} min lezen`
        : null
      : item.item.estimated_duration_minutes
        ? `${item.item.estimated_duration_minutes} min`
        : null;

  return (
    <Link
      href={href}
      className="group flex gap-4 border-b border-[var(--border)] py-4 transition-colors last:border-b-0 hover:bg-[var(--section-highlight)]/60 sm:gap-5"
    >
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:h-24 sm:w-36">
        {image ? (
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        {entity.difficulty_level ? (
          <DifficultyIndicator level={entity.difficulty_level} />
        ) : null}
        <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
          {entity.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-[var(--muted)]">
          {duration ? <span>{duration}</span> : null}
          <span className="text-[var(--accent)]">Bekijk project</span>
        </div>
      </div>
    </Link>
  );
}

function WorkshopFeature({ workshop }: { workshop: WorkshopDiscoveryItem }) {
  const placeLabel = placeOrOnlineLabel(workshop);
  const image =
    workshop.featured_image_url?.trim() || LANDING_IMAGES.workshop;

  return (
    <Link
      href={`/workshop/${workshop.slug}`}
      className="group relative flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-[1.25rem] sm:min-h-[26rem]"
    >
      <img
        src={image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        loading="lazy"
      />
      <span
        className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/85 via-[var(--foreground)]/35 to-transparent"
        aria-hidden
      />
      <div className="relative p-5 sm:p-7">
        {workshop.difficulty_level ? (
          <DifficultyIndicator level={workshop.difficulty_level} />
        ) : null}
        <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-white line-clamp-2 sm:text-3xl">
          {workshop.title}
        </h3>
        <p className="mt-2 text-[15px] font-semibold text-white/90">
          <DateDisplay date={workshop.nextSession.startsAt} format="short" />
          {" · "}
          {placeLabel}
        </p>
        <span className="mt-4 inline-flex min-h-11 items-center text-[15px] font-bold text-white underline underline-offset-4">
          Bekijk workshop
        </span>
      </div>
    </Link>
  );
}

function WorkshopSideCard({ workshop }: { workshop: WorkshopDiscoveryItem }) {
  const placeLabel = placeOrOnlineLabel(workshop);
  const image =
    workshop.featured_image_url?.trim() || LANDING_IMAGES.placeholderWorkshop;

  return (
    <Link
      href={`/workshop/${workshop.slug}`}
      className="group flex gap-3 rounded-[1rem] bg-[var(--card)] p-2 transition-colors hover:bg-[var(--section-highlight)] sm:gap-4"
    >
      <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)]">
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 flex-1 self-center pr-2">
        <h3 className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--foreground)] line-clamp-2 sm:text-lg">
          {workshop.title}
        </h3>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
          <DateDisplay date={workshop.nextSession.startsAt} format="short" />
          {" · "}
          {placeLabel}
        </p>
      </div>
    </Link>
  );
}

export function HomeDiscoverBlock({
  workshops,
  makeItems,
}: HomeDiscoverBlockProps) {
  const showWorkshops = workshops.length > 0;
  const showMake = makeItems.length > 0;
  if (!showWorkshops && !showMake) return null;

  const [featured, ...rest] = workshops;
  const sideWorkshops = rest.slice(0, 2);

  return (
    <div className="flex flex-col gap-14">
      {showWorkshops && featured ? (
        <HomeReveal>
          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
                  Leer iets nieuws
                </h2>
                <p className="mt-2 text-[15px] text-[var(--muted)]">
                  Eerstvolgende workshops met datum en plaats.
                </p>
              </div>
              <Link
                href="/workshops"
                className="inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
              >
                Alle workshops
              </Link>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] lg:gap-5">
              <WorkshopFeature workshop={featured} />
              {sideWorkshops.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {sideWorkshops.map((workshop) => (
                    <WorkshopSideCard key={workshop.id} workshop={workshop} />
                  ))}
                  {workshops.length > 3 ? (
                    <Link
                      href="/workshops"
                      className="mt-auto inline-flex min-h-11 items-center justify-center rounded-[0.75rem] border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-bold text-[var(--foreground)] hover:border-[var(--accent)]"
                    >
                      Nog {workshops.length - 3} workshops
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </HomeReveal>
      ) : null}

      {showMake ? (
        <HomeReveal>
          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
                  Maak het thuis
                </h2>
                <p className="mt-2 text-[15px] text-[var(--muted)]">
                  Stap-voor-stap projecten met duidelijke fotografie.
                </p>
              </div>
              <Link
                href="/artikelen"
                className="inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
              >
                Meer inspiratie
              </Link>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--card)] px-4 sm:px-5">
              {makeItems.map((item) => (
                <MakeListRow
                  key={`${item.kind}-${item.item.id}`}
                  item={item}
                />
              ))}
            </div>
          </section>
        </HomeReveal>
      ) : null}
    </div>
  );
}
