import Link from "next/link";
import { listActiveDomains } from "@/lib/platform/queries/domains";

export default async function HomePage() {
  let domains: Awaited<ReturnType<typeof listActiveDomains>> = [];
  try {
    domains = await listActiveDomains();
  } catch {
    // Platform DB not configured or unavailable
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
        Welkom bij Hobbysalon
      </h1>
      <p className="text-lg text-[var(--muted)] mb-8">
        Ontdek creatieve hobby&apos;s, makers en benodigdheden.
      </p>
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
        Domains
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {domains.length > 0 ? (
          domains.map((d) => (
            <Link
              key={d.id}
              href={`/${d.slug}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm hover:border-[var(--accent)] transition"
            >
              <h3 className="font-semibold text-[var(--foreground)]">{d.name}</h3>
              {d.short_description && (
                <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                  {d.short_description}
                </p>
              )}
            </Link>
          ))
        ) : (
          <p className="col-span-full text-[var(--muted)]">
            Geen domains gevonden. Voer de platform seed uit.
          </p>
        )}
      </div>
    </div>
  );
}
