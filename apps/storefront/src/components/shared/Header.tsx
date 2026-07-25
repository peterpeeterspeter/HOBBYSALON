import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Heart, ChevronDown, Search } from "lucide-react";
import { NavLink } from "@/components/shared/NavLink";
import { MobileMenu } from "@/components/shared/MobileMenu";
import { buttonVariants } from "@/components/ui/button";
import { listDomainNavLinks } from "@/lib/platform/queries/domains";
import { hasAuthSessionCookie } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";
import { ACCOUNT_NAV, STATIC_LINKS } from "@/config/nav";

export async function Header() {
  const hasSession = await hasAuthSessionCookie();

  let domainLinks: Array<{ id: string; slug: string; name: string }> = [];
  try {
    domainLinks = await listDomainNavLinks(24);
  } catch {
    domainLinks = [
      { id: "f-crochet", slug: "crochet", name: "Crochet" },
      { id: "f-knitting", slug: "knitting", name: "Breien" },
      { id: "f-pottery", slug: "pottery", name: "Keramiek" },
    ];
  }
  const mobileDomainLinks = domainLinks.slice(0, 12);

  const navLinkClass =
    "inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 text-[15px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  const iconBtnClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-[var(--foreground)] transition-colors hover:bg-[var(--background)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  const mobileLinkClass =
    "block rounded-md px-4 py-3 text-[var(--foreground)] transition-colors hover:bg-[var(--background)] hover:text-[var(--accent)]";

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]">
      <a href="#main-content" className="skip-link">
        Ga naar inhoud
      </a>

      {/* Main bar: single row */}
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-2">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          aria-label="Hobbysalon - ga naar home"
        >
          <Image
            src="/logo.png"
            alt="Hobbysalon"
            width={150}
            height={100}
            className="h-9 w-auto object-contain md:h-10"
            priority
          />
        </Link>

        {/* Search — left-aligned next to the logo; grows to push the nav to the right */}
        <div className="pointer-events-none min-w-0 flex-1 md:pointer-events-auto">
          <form
            action="/zoeken"
            role="search"
            className="hidden max-w-[480px] md:block"
          >
            <div className="relative">
              <Search
                size={18}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                type="search"
                name="q"
                placeholder="Zoek workshops, makers, materialen en creatieve inspiratie..."
                aria-label="Zoeken"
                className="h-10 w-full rounded-full border-[1.5px] border-[var(--border)] bg-[var(--background)] pl-10 pr-4 text-[15px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>
          </form>
        </div>

        {/* Main nav: content discovery plus platform destinations */}
        <nav
          className="hidden items-center gap-0.5 xl:flex"
          aria-label="Hoofdnavigatie"
        >
          <ContentDropdown navLinkClass={navLinkClass} />
          {STATIC_LINKS.main.map((link) => (
            <NavLink key={link.href} href={link.href} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: cart, favorites, auth (guests: Aanmelden/Registreren buttons | logged-in: Profiel) */}
        <div className="flex items-center gap-2">
          <Link href="/cart" className={iconBtnClass} aria-label="Winkelwagen">
            <ShoppingCart size={20} aria-hidden />
          </Link>
          <Link href="/favorites" className={`${iconBtnClass} hidden sm:inline-flex`} aria-label="Favorieten">
            <Heart size={20} aria-hidden />
          </Link>
          {hasSession ? (
            <ProfileDropdown navLinkClass={navLinkClass} logoutAction={logoutAction} />
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Aanmelden
              </Link>
              <Link
                href="/register"
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                Registreren
              </Link>
            </div>
          )}
          <MobileMenu
            mainLinks={[...STATIC_LINKS.main]}
            domainLinks={mobileDomainLinks.map((d) => ({ href: `/${d.slug}`, label: d.name }))}
            inspiratieLinks={[...STATIC_LINKS.inspiratie]}
            user={hasSession}
            mobileLinkClass={mobileLinkClass}
            iconBtnClass={iconBtnClass}
          />
        </div>
      </div>
    </header>
  );
}

function ProfileDropdown({
  navLinkClass,
  logoutAction,
}: {
  navLinkClass: string;
  logoutAction: typeof import("@/app/actions/auth").logoutAction;
}) {
  return (
    <details className="group relative hidden md:block">
      <summary className={`${navLinkClass} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}>
        Profiel
        <ChevronDown size={16} aria-hidden className="ml-0.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-0.5 min-w-[160px] rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 shadow-lg">
        <div className="flex flex-col gap-0.5">
          <Link
            href={ACCOUNT_NAV.profile.href}
            className="rounded-md px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--background)] hover:text-[var(--accent)]"
          >
            {ACCOUNT_NAV.profile.label}
          </Link>
          <Link
            href={ACCOUNT_NAV.pro.href}
            className="rounded-md px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--background)] hover:text-[var(--accent)]"
          >
            {ACCOUNT_NAV.pro.label}
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)] hover:text-[var(--accent)]"
            >
              Uitloggen
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}

function ContentDropdown({ navLinkClass }: { navLinkClass: string }) {
  return (
    <details className="group relative">
      <summary className={`${navLinkClass} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}>
        Ontdekken
        <ChevronDown size={16} aria-hidden className="ml-0.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg">
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Inspiratie
        </p>
        <div className="flex flex-col gap-0.5">
          {STATIC_LINKS.inspiratie.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] hover:text-[var(--accent)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}
