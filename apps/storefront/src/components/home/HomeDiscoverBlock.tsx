import Link from "next/link";
import { GridLayout } from "@/components/layout/grid-layout";
import { WorkshopDiscoveryCard } from "@/components/workshops/WorkshopDiscoveryCard";
import { DifficultyIndicator } from "@/components/domain/difficulty-indicator";
import type { HomeMakeItem } from "@/lib/services/home-page";
import type { WorkshopDiscoveryItem } from "@/lib/platform/queries/workshops";

type HomeDiscoverBlockProps = {
  workshops: WorkshopDiscoveryItem[];
  makeItems: HomeMakeItem[];
};

function MakeCard({ item }: { item: HomeMakeItem }) {
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
      className="flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)]"
    >
      <div className="aspect-video overflow-hidden bg-[var(--section-highlight)]">
        {image ? (
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {entity.difficulty_level ? (
          <DifficultyIndicator level={entity.difficulty_level} />
        ) : null}
        <h3 className="mt-2 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
          {entity.title}
        </h3>
        {duration ? (
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            {duration}
          </p>
        ) : null}
        <span className="mt-auto pt-3 text-[15px] font-bold text-[var(--accent)]">
          Bekijk project
        </span>
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

  return (
    <div className="mb-10 flex flex-col gap-10">
      {showWorkshops ? (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
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
          <GridLayout cols={3} gap="lg">
            {workshops.map((workshop) => (
              <WorkshopDiscoveryCard key={workshop.id} workshop={workshop} />
            ))}
          </GridLayout>
        </section>
      ) : null}

      {showMake ? (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
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
          <GridLayout cols={3} gap="lg">
            {makeItems.map((item) => (
              <MakeCard
                key={`${item.kind}-${item.item.id}`}
                item={item}
              />
            ))}
          </GridLayout>
        </section>
      ) : null}
    </div>
  );
}
