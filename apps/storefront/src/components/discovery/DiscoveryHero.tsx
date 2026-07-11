import Link from "next/link";
import { MapPin, Search } from "lucide-react";

type DiscoveryHeroProps = {
  title: string;
  description: string;
  searchAction?: string;
  searchName?: string;
  searchPlaceholder: string;
  locationLabel?: string | null;
  resetHref: string;
  primaryHref?: string;
  primaryLabel?: string;
};

export function DiscoveryHero({
  title,
  description,
  searchAction,
  searchName = "q",
  searchPlaceholder,
  locationLabel,
  resetHref,
  primaryHref,
  primaryLabel,
}: DiscoveryHeroProps) {
  return (
    <section className="mb-8 overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--hero-bg)] p-5 shadow-[var(--shadow-sm)] sm:p-8">
      <div className="max-w-3xl">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.035em] text-[var(--foreground)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">{description}</p>
      </div>
      {searchAction && (
        <form action={searchAction} role="search" className="mt-6 max-w-3xl">
          <label htmlFor={`${searchName}-discovery-search`} className="sr-only">Zoeken</label>
          <div className="flex flex-col gap-2 rounded-[1rem] border border-[var(--border-strong)] bg-[var(--card)] p-2 shadow-[var(--shadow-sm)] sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]" />
              <input id={`${searchName}-discovery-search`} type="search" name={searchName} placeholder={searchPlaceholder} className="min-h-12 w-full rounded-[0.75rem] bg-transparent py-2 pl-11 pr-3 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]/75" />
            </div>
            <button type="submit" className="min-h-12 rounded-[0.75rem] bg-[var(--accent)] px-6 font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px">Zoek</button>
          </div>
        </form>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {locationLabel && <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 font-semibold text-[var(--foreground)]"><MapPin aria-hidden="true" size={17} className="text-[var(--accent)]" />Dichtbij: {locationLabel}</span>}
        <Link href={resetHref} className="min-h-10 px-1 py-2 font-semibold text-[var(--accent)] underline underline-offset-4 hover:no-underline">Bekijk alles</Link>
        {primaryHref && primaryLabel && <Link href={primaryHref} className="min-h-10 px-1 py-2 font-semibold text-[var(--accent)] underline underline-offset-4 hover:no-underline">{primaryLabel}</Link>}
      </div>
    </section>
  );
}
