import { DateDisplay } from "@/components/domain/date-display";
import type { HomeEventTeaser } from "@/lib/services/home-page";
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
    <section className="mb-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
            Samen iets creatiefs beleven
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
            Ontdek markten, beurzen en open ateliers op een datum die jou past.
            Plan een creatief uitje met een vriendin.
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

      <ul className="flex flex-col gap-3">
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
                className="flex flex-col gap-1 rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-4 py-4 transition-colors hover:border-[var(--accent)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--foreground)]">
                    <DateDisplay date={event.starts_at} format="short" />
                    {" · "}
                    {place}
                    {" · "}
                    {typeLabel}
                  </p>
                  <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
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
  );
}
