"use client";

import { Search } from "lucide-react";
import { trackEvent } from "@/lib/analytics/track";
import { TrackedLink } from "./TrackedLink";

type HomeHeroProps = {
  weekendHref: string;
};

export function HomeHero({ weekendHref }: HomeHeroProps) {
  return (
    <section className="mb-8">
      <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.035em] text-[var(--foreground)] sm:text-4xl lg:text-5xl">
        Zin om iets moois te maken?
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
        Vind een creatief uitje, workshop, maker of stap-voor-stap project in
        België en Nederland.
      </p>

      <form
        method="GET"
        action="/zoeken"
        role="search"
        className="mt-6 max-w-3xl"
        onSubmit={(e) => {
          const form = e.currentTarget;
          const q = new FormData(form).get("q");
          trackEvent("home_search_submitted", {
            query: typeof q === "string" ? q : "",
          });
        }}
      >
        <label htmlFor="home-q" className="sr-only">
          Zoek op hobby, workshop of plaats
        </label>
        <div className="flex flex-col gap-2 rounded-[1rem] border border-[var(--border-strong)] bg-[var(--card)] p-2 shadow-[var(--shadow-sm)] sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              size={20}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]"
            />
            <input
              id="home-q"
              type="search"
              name="q"
              placeholder="Zoek bijvoorbeeld haken, keramiek of Herentals"
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

      <div className="mt-5 flex flex-wrap gap-2">
        <TrackedLink
          href={weekendHref}
          event="home_route_clicked"
          eventPayload={{ route: "weekend" }}
          className="inline-flex min-h-11 items-center rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 text-[15px] font-semibold text-[var(--accent-foreground)]"
        >
          Wat gebeurt er dit weekend?
        </TrackedLink>
        <TrackedLink
          href="/workshops"
          event="home_route_clicked"
          eventPayload={{ route: "workshops" }}
          className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          Vind een workshop
        </TrackedLink>
        <TrackedLink
          href="/artikelen"
          event="home_route_clicked"
          eventPayload={{ route: "make_at_home" }}
          className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          Thuis iets maken
        </TrackedLink>
      </div>
    </section>
  );
}
