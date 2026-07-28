import { DateDisplay } from "@/components/domain/date-display";
import type { HomeEventTeaser } from "@/lib/services/home-page";
import { HomeReveal } from "./HomeReveal";
import { TrackedLink } from "./TrackedLink";

const EVENT_TYPE_LABELS: Record<string, string> = {
  market: "Makersmarkt",
  fair: "Beurs",
  open_studio: "Open atelier",
  exhibition: "Tentoonstelling",
  workshop_day: "Workshopdag",
  other: "Event",
};

type HomeAgendaTeaserProps = {
  events: HomeEventTeaser[];
};

export function HomeAgendaTeaser({ events }: HomeAgendaTeaserProps) {
  if (events.length === 0) return null;

  return (
    <HomeReveal>
      <section className="py-2">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
              Samen iets creatiefs beleven
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
            Bekijk agenda
          </TrackedLink>
        </div>

        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {events.map((event) => {
            const place =
              event.city?.trim() ||
              event.location_name?.trim() ||
              "Locatie volgt";
            const typeLabel =
              EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;
            const makerNames = event.makers
              .slice(0, 3)
              .map((m) => m.studioName)
              .join(", ");

            return (
              <li key={event.id}>
                <TrackedLink
                  href={`/agenda/${event.slug}`}
                  event="home_event_clicked"
                  eventPayload={{
                    event_id: event.id,
                    event_slug: event.slug,
                  }}
                  className="group grid gap-3 py-5 transition-colors hover:bg-[var(--section-highlight)]/80 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-2"
                >
                  <div className="font-[family-name:var(--font-heading)] text-lg font-bold leading-tight text-[var(--accent)] sm:text-xl">
                    <DateDisplay date={event.starts_at} format="short" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      {place}
                      {" · "}
                      {typeLabel}
                    </p>
                    <h3 className="mt-1 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                      {event.title}
                    </h3>
                    {makerNames ? (
                      <p className="mt-1 text-sm text-[var(--muted)] line-clamp-1">
                        Met o.a. {makerNames}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
                    Bekijk event
                  </span>
                </TrackedLink>
              </li>
            );
          })}
        </ul>
      </section>
    </HomeReveal>
  );
}
