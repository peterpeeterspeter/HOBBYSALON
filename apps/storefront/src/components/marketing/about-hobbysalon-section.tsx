import { Container } from "@/components/ui/container";
import { ABOUT_HOBBYSALON } from "@/lib/marketing/about-hobbysalon";

const copy = ABOUT_HOBBYSALON;

/**
 * Reusable story block for aanbieder landings.
 * Place after the page CTA on every /voor-* provider page.
 */
function AboutHobbysalonSection() {
  return (
    <section
      aria-labelledby="about-hobbysalon-heading"
      className="border-t border-[var(--border)] bg-[var(--background)]"
    >
      <Container className="py-16 md:py-24">
        <p className="text-base font-semibold text-[var(--accent)] md:text-lg">
          {copy.sectionLabel}
        </p>
        <h2
          id="about-hobbysalon-heading"
          className="mt-2 max-w-[18ch] font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl"
        >
          {copy.headline}
        </h2>

        <div className="mt-8 max-w-[65ch] space-y-5 md:mt-10">
          {copy.origin.map((paragraph) => (
            <p
              key={paragraph.slice(0, 48)}
              className="text-base leading-relaxed text-[var(--muted)] md:text-lg"
            >
              {paragraph}
            </p>
          ))}
        </div>

        <h3 className="mt-14 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:mt-16 md:text-3xl">
          {copy.offeringsTitle}
        </h3>

        <ul className="mt-8 grid gap-0 border-t border-[var(--border-strong)]/45 md:mt-10">
          {copy.offerings.map((item) => (
            <li
              key={item.title}
              className="border-b border-[var(--border-strong)]/45 py-6 md:py-7"
            >
              <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] md:text-xl">
                {item.title}
              </p>
              <p className="mt-2 max-w-[65ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {item.body}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-14 max-w-3xl border-l-4 border-[var(--accent)] pl-6 md:mt-16 md:pl-8">
          <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
            {copy.connectedTitle}
          </h3>
          <div className="mt-4 space-y-4">
            {copy.connected.map((paragraph) => (
              <p
                key={paragraph.slice(0, 48)}
                className="text-base leading-relaxed text-[var(--muted)] md:text-lg"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export { AboutHobbysalonSection };
