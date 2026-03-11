import Link from "next/link";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { getAuthUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";

export async function Header() {
  const user = await getAuthUser();
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

  const navLinks = [
    { href: "/agenda", label: "Agenda" },
    { href: "/workshops", label: "Workshops" },
    { href: "/cart", label: "Winkelwagen" },
    { href: "/favorites", label: "Favorieten" },
    ...domainLinks.map((domain) => ({
      href: `/${domain.slug}`,
      label: domain.name,
    })),
    { href: "/creators", label: "Creators" },
  ];

  const desktopLinkClass =
    "inline-flex min-h-11 items-center rounded-md px-3 py-2 text-[var(--foreground)] transition-colors hover:bg-[var(--background)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  const mobileLinkClass =
    "block w-full rounded-md px-3 py-2 text-[var(--foreground)] transition-colors hover:bg-[var(--background)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  const mobileButtonClass =
    "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <a href="#main-content" className="skip-link">
        Ga naar inhoud
      </a>
      <div className="mx-auto max-w-6xl px-4 py-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md px-2 text-xl font-bold text-[var(--foreground)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Hobbysalon
        </Link>
        <div className="mt-3 hidden flex-wrap items-center justify-end gap-1 md:flex">
          <nav className="flex flex-wrap items-center gap-1" aria-label="Hoofdnavigatie">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={desktopLinkClass}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {user ? (
            <Link
              href="/dashboard"
              className={desktopLinkClass}
            >
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className={desktopLinkClass}>
              Inloggen
            </Link>
          )}
          {user && (
            <form action={logoutAction}>
              <button type="submit" className={desktopLinkClass}>
                Uitloggen
              </button>
            </form>
          )}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 md:hidden">
          <Link href="/cart" className={mobileButtonClass}>
            Winkelwagen
          </Link>
          <details className="relative">
            <summary className={mobileButtonClass}>Menu</summary>
            <nav
              aria-label="Mobiele navigatie"
              className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg"
            >
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className={mobileLinkClass}>
                  {link.label}
                </Link>
              ))}
              <div className="my-2 border-t border-[var(--border)]" />
              {user ? (
                <>
                  <Link href="/dashboard" className={mobileLinkClass}>
                    Dashboard
                  </Link>
                  <form action={logoutAction}>
                    <button type="submit" className={`${mobileLinkClass} text-left`}>
                      Uitloggen
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className={mobileLinkClass}>
                  Inloggen
                </Link>
              )}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
