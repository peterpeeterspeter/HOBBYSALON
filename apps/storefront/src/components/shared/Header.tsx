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

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-xl font-bold text-[var(--foreground)] hover:text-[var(--accent)]"
        >
          Hobbysalon
        </Link>
        <nav className="flex items-center gap-6" aria-label="Hoofdnavigatie">
          <Link
            href="/agenda"
            className="text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Agenda
          </Link>
          <Link
            href="/workshops"
            className="text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Workshops
          </Link>
          <Link
            href="/cart"
            className="text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Winkelwagen
          </Link>
          <Link
            href="/favorites"
            className="text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Favorieten
          </Link>
          {domainLinks.map((domain) => (
            <Link
              key={domain.id}
              href={`/${domain.slug}`}
              className="text-[var(--foreground)] hover:text-[var(--accent)]"
            >
              {domain.name}
            </Link>
          ))}
          <Link
            href="/creators"
            className="text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Creators
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-[var(--foreground)] hover:text-[var(--accent)]"
              >
                Dashboard
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-[var(--foreground)] hover:text-[var(--accent)]"
                >
                  Uitloggen
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-[var(--foreground)] hover:text-[var(--accent)]"
            >
              Inloggen
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
