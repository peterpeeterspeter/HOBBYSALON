import { Container } from "@/components/ui/container";
import { TrackedLink } from "./TrackedLink";

export function HomeProvidersCta() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--section-alt)]">
      <Container className="py-12 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
            Deel wat jij maakt of organiseert
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Geef je workshops, sta je op markten, verkoop je materialen of
            organiseer je een creatief event?
          </p>
          <TrackedLink
            href="/partners"
            event="home_provider_clicked"
            eventPayload={{ destination: "/partners" }}
            className="mt-6 inline-flex min-h-12 items-center rounded-[0.75rem] bg-[var(--accent)] px-6 font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px"
          >
            Kies je rol
          </TrackedLink>
        </div>
      </Container>
    </section>
  );
}
