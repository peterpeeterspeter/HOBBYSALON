import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import type { HomeJourney } from "@/lib/services/home-journey";
import { HomeReveal } from "./HomeReveal";
import { TrackedLink } from "./TrackedLink";

type HomeJourneySectionProps = {
  journey: HomeJourney;
};

export function HomeJourneySection({ journey }: HomeJourneySectionProps) {
  const imageSrc = journey.imageUrl?.trim() || LANDING_IMAGES.craftsGrid;

  return (
    <HomeReveal>
      <section className="overflow-hidden rounded-[1.25rem] bg-[var(--section-alt)]">
        <div className="grid md:grid-cols-2">
          <div className="relative min-h-56 md:min-h-full">
            <img
              src={imageSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
              {journey.title}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
              Materialen, workshop en makers bij elkaar. Zo begin je meteen.
            </p>

            <ul className="mt-6 space-y-3 text-[15px] leading-relaxed text-[var(--foreground)]">
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
              className="mt-7 inline-flex min-h-11 w-fit items-center rounded-[0.75rem] bg-[var(--accent)] px-5 font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px"
            >
              Bekijk dit project
            </TrackedLink>
          </div>
        </div>
      </section>
    </HomeReveal>
  );
}
