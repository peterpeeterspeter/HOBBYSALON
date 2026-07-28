"use client";

import Image from "next/image";
import { Search } from "lucide-react";
import { Container } from "@/components/ui/container";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { trackEvent } from "@/lib/analytics/track";
import { TrackedLink } from "./TrackedLink";

type HomeHeroProps = {
  weekendHref: string;
  imageSrc?: string | null;
};

export function HomeHero({ weekendHref, imageSrc }: HomeHeroProps) {
  const src = imageSrc?.trim() || LANDING_IMAGES.hero;
  const isLocal = src.startsWith("/");

  return (
    <section className="relative isolate overflow-hidden bg-[var(--foreground)]">
      <div className="absolute inset-0">
        {isLocal ? (
          <Image
            src={src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        ) : (
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/88 via-[var(--foreground)]/55 to-[var(--foreground)]/25 md:bg-gradient-to-r md:from-[var(--foreground)]/82 md:via-[var(--foreground)]/50 md:to-[var(--foreground)]/15"
          aria-hidden
        />
      </div>

      <Container className="relative flex min-h-[min(100dvh,40rem)] flex-col justify-end pb-10 pt-16 sm:min-h-[min(100dvh,44rem)] sm:pb-14 sm:pt-20 lg:justify-center lg:py-20">
        <div className="home-reveal max-w-2xl">
          <p className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">
            Hobbysalon
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-bold leading-[1.1] tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">
            Zin om iets moois te maken?
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/90">
            Vind een creatief uitje, workshop, maker of project in België en
            Nederland.
          </p>

          <form
            method="GET"
            action="/zoeken"
            role="search"
            className="mt-7 max-w-xl"
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
            <div className="flex flex-col gap-2 rounded-[1rem] border border-white/25 bg-white/95 p-2 shadow-[var(--shadow-md)] backdrop-blur-sm sm:flex-row">
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
                  className="min-h-12 w-full rounded-[0.75rem] bg-transparent py-2 pl-11 pr-3 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]/80"
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
              className="inline-flex min-h-11 items-center rounded-full bg-[var(--accent)] px-4 text-[15px] font-semibold text-[var(--accent-foreground)] transition-transform active:translate-y-px"
            >
              Wat gebeurt er dit weekend?
            </TrackedLink>
            <TrackedLink
              href="/workshops"
              event="home_route_clicked"
              eventPayload={{ route: "workshops" }}
              className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-white/15 px-4 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 active:translate-y-px"
            >
              Vind een workshop
            </TrackedLink>
            <TrackedLink
              href="/artikelen"
              event="home_route_clicked"
              eventPayload={{ route: "make_at_home" }}
              className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-white/15 px-4 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 active:translate-y-px"
            >
              Thuis iets maken
            </TrackedLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
