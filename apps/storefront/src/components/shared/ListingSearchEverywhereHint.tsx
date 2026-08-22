import Link from "next/link";

type ListingSearchEverywhereHintProps = {
  /** Current page-local query, if any. */
  query?: string | null;
};

/**
 * Clarifies that listing heroes only filter the current catalog.
 * Global search (header / /zoeken) covers workshops, materials, makers, events, articles.
 */
export function ListingSearchEverywhereHint({
  query,
}: ListingSearchEverywhereHintProps) {
  const q = query?.trim();
  const href =
    q && q.length >= 2
      ? `/zoeken?q=${encodeURIComponent(q)}`
      : "/zoeken";

  return (
    <p className="mt-3 text-[15px] text-white/85">
      {q && q.length >= 2 ? (
        <>
          Je zoekt nu op deze pagina.{" "}
          <Link
            href={href}
            className="font-semibold text-white underline underline-offset-4 hover:text-white"
          >
            Zoek “{q}” overal op Hobbysalon
          </Link>
          {" "}
          (workshops, materialen, makers, agenda en artikelen).
        </>
      ) : (
        <>
          Dit veld filtert alleen deze pagina.{" "}
          <Link
            href="/zoeken"
            className="font-semibold text-white underline underline-offset-4 hover:text-white"
          >
            Zoek overal
          </Link>
          {" "}
          via de zoekbalk bovenaan of op Zoeken.
        </>
      )}
    </p>
  );
}
