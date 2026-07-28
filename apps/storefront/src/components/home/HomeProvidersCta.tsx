import { TrackedLink } from "./TrackedLink";

export function HomeProvidersCta() {
  return (
    <section className="mb-4 rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
      <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
        Deel wat jij maakt of organiseert
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
        Geef je workshops, sta je op markten, verkoop je materialen of organiseer
        je een creatief event?
      </p>
      <TrackedLink
        href="/partners"
        event="home_provider_clicked"
        eventPayload={{ destination: "/partners" }}
        className="mt-4 inline-flex min-h-11 items-center rounded-[0.75rem] bg-[var(--accent)] px-5 font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
      >
        Kies je rol
      </TrackedLink>
    </section>
  );
}
