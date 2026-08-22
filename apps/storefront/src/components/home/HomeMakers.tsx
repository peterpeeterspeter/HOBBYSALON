import Link from "next/link";
import type { CreatorDirectoryItem } from "@/lib/platform/queries/creators";
import { HomeReveal } from "./HomeReveal";

type HomeMakersProps = {
  makers: CreatorDirectoryItem[];
};

export function HomeMakers({ makers }: HomeMakersProps) {
  const withPhoto = makers.filter((creator) => Boolean(creator.photoUrl?.trim()));
  if (withPhoto.length === 0) return null;

  return (
    <HomeReveal>
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
              Ontmoet de mensen achter je hobby
            </h2>
            <p className="mt-2 max-w-xl text-[15px] text-[var(--muted)]">
              Makers die workshops geven, creaties maken of op markten staan.
            </p>
          </div>
          <Link
            href="/creators"
            className="inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
          >
            Alle makers
          </Link>
        </div>

        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-smooth sm:-mx-6 sm:px-6 [scrollbar-width:thin]">
          {withPhoto.map((creator) => {
            const city = creator.city?.trim();
            return (
              <Link
                key={creator.id}
                href={`/creator/${creator.slug}`}
                className="group w-44 shrink-0 snap-start sm:w-52"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-[var(--section-alt)]">
                  <img
                    src={creator.photoUrl!}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    loading="lazy"
                  />
                </div>
                <h3 className="mt-3 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
                  {creator.studioName}
                </h3>
                {creator.specialtyLine ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)] line-clamp-2">
                    {creator.specialtyLine}
                  </p>
                ) : city ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    {city}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>
    </HomeReveal>
  );
}
