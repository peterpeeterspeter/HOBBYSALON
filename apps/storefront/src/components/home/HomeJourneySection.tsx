import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import type { HomeJourney } from "@/lib/services/home-journey";
import { HomeReveal } from "./HomeReveal";
import { TrackedLink } from "./TrackedLink";

type HomeJourneySectionProps = {
  journey: HomeJourney;
};

export function HomeJourneySection({ journey }: HomeJourneySectionProps) {
  const imageSrc = journey.imageUrl?.trim() || LANDING_IMAGES.craftsGrid;
  const legs: string[] = [];
  if (journey.materials.length > 0) legs.push("materialen");
  if (journey.workshop) legs.push("workshop");
  if (journey.makers.length > 0) legs.push("makers");
  const legLabel =
    legs.length > 1
      ? `${legs.slice(0, -1).join(", ")} en ${legs[legs.length - 1]}`
      : legs[0] === "workshop"
        ? "een workshop"
        : legs[0];
  const lead = legLabel
    ? `${legLabel.charAt(0).toUpperCase()}${legLabel.slice(1)} bij dit idee.`
    : "Ontdek dit idee.";

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
              {lead}
            </p>

            <ul className="mt-6 space-y-3 text-[15px] leading-relaxed text-[var(--foreground)]">
              {journey.materials.length > 0 ? (
                <li>
                  <span className="font-semibold">Materialen bij dit idee: </span>
                  {journey.materials.map((material, index) => (
                    <span key={material.href || `${material.label}:${index}`}>
                      {index > 0 ? ", " : null}
                      {material.href ? (
                        <TrackedLink
                          href={material.href}
                          event="home_journey_clicked"
                          eventPayload={{
                            journey_kind: journey.kind,
                            href: material.href,
                            leg: "material",
                          }}
                          className="font-semibold text-[var(--accent)] underline underline-offset-4"
                        >
                          {material.label}
                        </TrackedLink>
                      ) : (
                        material.label
                      )}
                    </span>
                  ))}
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
              {journey.kind === "article" ? "Lees dit artikel" : "Bekijk dit project"}
            </TrackedLink>
          </div>
        </div>
      </section>
    </HomeReveal>
  );
}
