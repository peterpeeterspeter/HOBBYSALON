import { DateDisplay } from "@/components/domain/date-display";
import { AGENDA_EVENT_TYPE_OPTIONS } from "@/components/events/AgendaFilterBar";
import { publicAssetUrl } from "@/lib/media/public-asset-url";
import type { HomeEventTeaser } from "@/lib/services/home-page";
import { HomeReveal } from "./HomeReveal";
import { TrackedLink } from "./TrackedLink";

const EVENT_TYPE_LABELS = Object.fromEntries(
  AGENDA_EVENT_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

type HomeAgendaTeaserProps = {
  events: HomeEventTeaser[];
};

export function HomeAgendaTeaser({ events }: HomeAgendaTeaserProps) {
  if (events.length === 0) return null;

  return (
    <HomeReveal>
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
              Creatieve events in de buurt
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
              Markten, beurzen en open ateliers. Plan een creatief uitje.
            </p>
          </div>
          <TrackedLink
            href="/agenda"
            event="home_route_clicked"
            eventPayload={{ route: "agenda" }}
            className="inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
          >
            Alle events
          </TrackedLink>
        </div>

        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-smooth sm:-mx-6 sm:gap-5 sm:px-6 [scrollbar-width:thin]">
          {events.map((event) => {
            const place =
              event.city?.trim() ||
              event.location_name?.trim() ||
              "Locatie volgt";
            const typeLabel =
              EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;
            const imageUrl = publicAssetUrl(event.featured_image_url);
            const makerNames = event.makers
              .slice(0, 2)
              .map((maker) => maker.studioName)
              .join(", ");

            return (
              <TrackedLink
                key={event.id}
                href={`/agenda/${event.slug}`}
                event="home_event_clicked"
                eventPayload={{
                  event_id: event.id,
                  event_slug: event.slug,
                }}
                className="group w-64 shrink-0 snap-start sm:w-72"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-[var(--section-alt)]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <p className="mt-3 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--accent)]">
                  <DateDisplay date={event.starts_at} format="short" />
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                  {place}
                  {" · "}
                  {typeLabel}
                </p>
                <h3 className="mt-1 font-[family-name:var(--font-heading)] text-xl font-bold leading-snug text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                  {event.title}
                </h3>
                {makerNames ? (
                  <p className="mt-1 text-sm text-[var(--muted)] line-clamp-1">
                    Met o.a. {makerNames}
                  </p>
                ) : null}
              </TrackedLink>
            );
          })}
        </div>
      </section>
    </HomeReveal>
  );
}
