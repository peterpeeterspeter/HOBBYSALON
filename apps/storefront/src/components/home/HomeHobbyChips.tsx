import Link from "next/link";
import {
  getDomainPlaceholderImage,
} from "@/components/ui/ai-generated-image";
import type { Domain } from "@/types/platform";
import { HomeReveal } from "./HomeReveal";

type HomeHobbyChipsProps = {
  domains: Domain[];
};

export function HomeHobbyChips({ domains }: HomeHobbyChipsProps) {
  if (domains.length === 0) return null;

  return (
    <HomeReveal>
      <section aria-label="Hobby's">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
          Kies je hobby
        </h2>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          Spring meteen naar een categorie met live content.
        </p>
        <div className="-mx-4 mt-5 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-smooth sm:-mx-6 sm:px-6 [scrollbar-width:thin]">
          {domains.map((domain) => {
            const thumb =
              domain.hero_image_url?.trim() ||
              getDomainPlaceholderImage(domain.slug);
            return (
              <Link
                key={domain.id}
                href={`/${domain.slug}`}
                className="group relative h-36 w-44 shrink-0 snap-start overflow-hidden rounded-[1rem] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 sm:h-40 sm:w-52"
              >
                <img
                  src={thumb}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  loading="lazy"
                />
                <span
                  className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/75 via-[var(--foreground)]/20 to-transparent"
                  aria-hidden
                />
                <span className="absolute inset-x-0 bottom-0 p-3 font-[family-name:var(--font-heading)] text-base font-bold text-white sm:text-lg">
                  {domain.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </HomeReveal>
  );
}
