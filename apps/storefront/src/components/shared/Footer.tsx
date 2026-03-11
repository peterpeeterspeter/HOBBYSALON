import Link from "next/link";
import { listDomainsBySort } from "@/lib/platform/queries/domains";

export async function Footer() {
  let domainLinks: Array<{ id: string; slug: string; name: string }> = [];
  try {
    const domains = await listDomainsBySort();
    domainLinks = domains.slice(0, 3).map((domain) => ({
      id: domain.id,
      slug: domain.slug,
      name: domain.name,
    }));
  } catch {
    domainLinks = [
      { id: "fallback-crochet", slug: "crochet", name: "Crochet" },
      { id: "fallback-knitting", slug: "knitting", name: "Breien" },
      { id: "fallback-pottery", slug: "pottery", name: "Keramiek" },
    ];
  }

  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--card)] py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            © {new Date().getFullYear()} Hobbysalon. Creatief platform voor hobbyisten.
          </p>
          <nav className="flex gap-4" aria-label="Footernavigatie">
            {domainLinks.map((domain) => (
              <Link
                key={domain.id}
                href={`/${domain.slug}`}
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {domain.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
