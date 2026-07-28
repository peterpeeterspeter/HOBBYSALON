import type { HomeJourney } from "@/lib/services/home-journey";
import { TrackedLink } from "./TrackedLink";

type HomeJourneySectionProps = {
  journey: HomeJourney;
};

export function HomeJourneySection({ journey }: HomeJourneySectionProps) {
  return (
    <section className="mb-10 rounded-[12px] border border-[var(--border)] bg-[var(--section-highlight)] p-5 sm:p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
        Stap-voor-stap project
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
        {journey.title}
      </h2>

      <ul className="mt-5 flex flex-col gap-3 text-[15px] leading-relaxed text-[var(--foreground)]">
        {journey.materials.length > 0 ? (
          <li>
            <span className="font-semibold">Dit heb je nodig: </span>
            {journey.materials.map((m) => m.label).join(", ")}
          </li>
        ) : null}
        {journey.workshop ? (
          <li>
            <span className="font-semibold">Workshop: </span>
            {journey.workshop.href ? (
              <TrackedLink
                href={journey.workshop.href}
                event="home_journey_clicked"
                eventPayload={{
                  journey_kind: journey.kind,
                  href: journey.workshop.href,
                  leg: "workshop",
                }}
                className="font-semibold text-[var(--accent)] underline underline-offset-4"
              >
                {journey.workshop.label}
              </TrackedLink>
            ) : (
              journey.workshop.label
            )}
          </li>
        ) : null}
        {journey.makers.length > 0 ? (
          <li>
            <span className="font-semibold">Makers: </span>
            {journey.makers.map((maker, index) => (
              <span key={maker.label}>
                {index > 0 ? ", " : null}
                {maker.href ? (
                  <TrackedLink
                    href={maker.href}
                    event="home_journey_clicked"
                    eventPayload={{
                      journey_kind: journey.kind,
                      href: maker.href,
                      leg: "maker",
                    }}
                    className="font-semibold text-[var(--accent)] underline underline-offset-4"
                  >
                    {maker.label}
                  </TrackedLink>
                ) : (
                  maker.label
                )}
              </span>
            ))}
          </li>
        ) : null}
      </ul>

      <TrackedLink
        href={journey.href}
        event="home_journey_clicked"
        eventPayload={{ journey_kind: journey.kind, href: journey.href }}
        className="mt-5 inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
      >
        Bekijk dit project
      </TrackedLink>
    </section>
  );
}
