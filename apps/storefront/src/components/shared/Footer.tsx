import Link from "next/link";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { NewsletterSignupForm } from "@/components/shared/NewsletterSignupForm";

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
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm text-[var(--muted)]" suppressHydrationWarning>
              © {new Date().getFullYear()} Hobbysalon. Creatief platform voor hobbyisten.
            </p>
            <nav className="mt-3 flex flex-wrap gap-4" aria-label="Footernavigatie">
              <Link
                href="/landing"
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Over Hobbysalon
              </Link>
              <Link
                href="/favorites"
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Favorieten
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Dashboard
              </Link>
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
          <NewsletterSignupForm />
        </div>
      </div>
    </footer>
  );
}
