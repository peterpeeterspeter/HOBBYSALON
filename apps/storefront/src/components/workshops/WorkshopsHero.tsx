import { Search } from "lucide-react";

type WorkshopsHeroProps = {
  hiddenFields?: Record<string, string | undefined>;
  defaultQuery?: string;
};

export function WorkshopsHero({
  hiddenFields = {},
  defaultQuery,
}: WorkshopsHeroProps) {
  return (
    <section className="mb-6">
      <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.035em] text-[var(--foreground)] sm:text-4xl">
        Vind een workshop die bij je past
      </h1>
      <p className="mt-2 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
        Leer iets nieuws, dichtbij of online.
      </p>
      <form method="GET" action="/workshops" role="search" className="mt-5 max-w-3xl">
        {Object.entries(hiddenFields).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}
        <label htmlFor="workshops-q" className="sr-only">
          Wat wil je leren?
        </label>
        <div className="flex flex-col gap-2 rounded-[1rem] border border-[var(--border-strong)] bg-[var(--card)] p-2 shadow-[var(--shadow-sm)] sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              size={20}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]"
            />
            <input
              id="workshops-q"
              type="search"
              name="q"
              defaultValue={defaultQuery ?? ""}
              placeholder="Wat wil je leren? Bijvoorbeeld keramiek, haken of juwelen"
              className="min-h-12 w-full rounded-[0.75rem] bg-transparent py-2 pl-11 pr-3 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]/75"
            />
          </div>
          <button
            type="submit"
            className="min-h-12 rounded-[0.75rem] bg-[var(--accent)] px-6 font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px"
          >
            Zoek
          </button>
        </div>
      </form>
    </section>
  );
}
