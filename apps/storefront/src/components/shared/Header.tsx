import Link from "next/link";
import Image from "next/image";
import { Menu, X, ShoppingCart, Heart, ChevronDown, MapPin } from "lucide-react";
import { NavLink } from "@/components/shared/NavLink";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { getAuthUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";
import {
  clearLocationPreferenceAction,
  updateLocationPreferenceAction,
} from "@/app/actions/location";
import { getLocationPreference } from "@/lib/location/preference";
import { STATIC_LINKS } from "@/config/nav";

export async function Header() {
  const user = await getAuthUser();
  const locationPreference = await getLocationPreference();
  let domainLinks: Array<{ id: string; slug: string; name: string }> = [];
  try {
    const domains = await listDomainsBySort();
    domainLinks = domains.map((domain) => ({
      id: domain.id,
      slug: domain.slug,
      name: domain.name,
    }));
  } catch {
    domainLinks = [
      { id: "f-crochet", slug: "crochet", name: "Crochet" },
      { id: "f-knitting", slug: "knitting", name: "Breien" },
      { id: "f-pottery", slug: "pottery", name: "Keramiek" },
    ];
  }

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
            width={140}
            height={40}
            className="h-8 w-auto object-contain md:h-9"
            priority
          />
        </Link>

        {/* Desktop nav: Agenda, Workshops, Creators, Domeinen dropdown */}
        <nav
          className="hidden items-center gap-0.5 lg:flex"
          aria-label="Hoofdnavigatie"
        >
          {STATIC_LINKS.discover.map((link) => (
            <NavLink key={link.href} href={link.href} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
          <DomainsDropdown domainLinks={domainLinks} navLinkClass={navLinkClass} />
        </nav>

        {/* Spacer */}
        <div className="min-w-0 flex-1" />

        {/* Right: cart, favorites, account */}
        <div className="flex items-center gap-0.5">
          <Link href="/cart" className={iconBtnClass} aria-label="Winkelwagen">
            <ShoppingCart size={20} aria-hidden />
          </Link>
          <Link href="/favorites" className={`${iconBtnClass} hidden sm:inline-flex`} aria-label="Favorieten">
            <Heart size={20} aria-hidden />
          </Link>
          {user ? (
            <>
              <Link href="/profile" className={`${navLinkClass} hidden md:inline-flex`}>
                Profiel
              </Link>
              <Link href="/dashboard" className={`${navLinkClass} hidden md:inline-flex`}>
                Dashboard
              </Link>
              <form action={logoutAction} className="hidden md:block">
                <button type="submit" className={navLinkClass}>
                  Uitloggen
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={`${navLinkClass} hidden md:inline-flex`}>
              Inloggen
            </Link>
          )}
          <MobileMenu
            mainLinks={[
              ...STATIC_LINKS.discover,
              ...domainLinks.map((d) => ({ href: `/${d.slug}`, label: d.name })),
            ]}
            user={!!user}
            logoutAction={logoutAction}
            mobileLinkClass={mobileLinkClass}
            iconBtnClass={iconBtnClass}
          />
        </div>
      </div>

      {/* Location panel - collapsible, below main bar */}
      <details className="group border-t border-[var(--border)]">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
          <MapPin size={14} aria-hidden />
          Locatie: {locationPreference.label ?? "niet ingesteld"}
        </summary>
        <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] bg-[var(--background)]/60 px-4 py-3">
          <form
            action={updateLocationPreferenceAction}
            className="flex flex-wrap items-end gap-2"
          >
            <input
              type="text"
              name="city"
              defaultValue={locationPreference.city ?? ""}
              placeholder="Stad (bv. Antwerpen)"
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] w-40"
            />
            <input
              type="text"
              name="country_code"
              defaultValue={locationPreference.countryCode ?? ""}
              placeholder="Landcode (BE)"
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] w-24"
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
            >
              Opslaan
            </button>
          </form>
          {locationPreference.hasPreference && (
            <form action={clearLocationPreferenceAction}>
              <button
                type="submit"
                className="text-sm text-[var(--muted)] hover:text-[var(--accent)] hover:underline"
              >
                Wissen
              </button>
            </form>
          )}
        </div>
      </details>
    </header>
  );
}

function DomainsDropdown({
  domainLinks,
  navLinkClass,
}: {
  domainLinks: Array<{ id: string; slug: string; name: string }>;
  navLinkClass: string;
}) {
  if (domainLinks.length === 0) return null;
  return (
    <details className="group relative">
      <summary className={`${navLinkClass} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}>
        Domeinen
        <ChevronDown size={16} aria-hidden className="ml-0.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 shadow-lg">
        <div className="grid grid-cols-2 gap-0.5 px-1 sm:grid-cols-3">
          {domainLinks.map((d) => (
            <Link
              key={d.id}
              href={`/${d.slug}`}
              className="rounded-md px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--background)] hover:text-[var(--accent)]"
            >
              {d.name}
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}

function MobileMenu({
  mainLinks,
  user,
  logoutAction,
  mobileLinkClass,
  iconBtnClass,
}: {
  mainLinks: Array<{ href: string; label: string }>;
  user: boolean;
  logoutAction: typeof import("@/app/actions/auth").logoutAction;
  mobileLinkClass: string;
  iconBtnClass: string;
}) {
  return (
    <details className="group relative lg:hidden">
      <summary className={`${iconBtnClass} list-none cursor-pointer`}>
        <Menu size={22} aria-hidden className="group-open:hidden" />
        <X size={22} aria-hidden className="hidden group-open:block" />
      </summary>
      <nav
        aria-label="Mobiele navigatie"
        className="absolute right-0 top-full z-50 mt-1 w-72 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg"
      >
        <div className="space-y-0.5">
          {mainLinks.map((link) => (
            <Link key={link.href} href={link.href} className={mobileLinkClass}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="my-2 border-t border-[var(--border)]" />
        <div className="space-y-0.5">
          <Link href="/cart" className={mobileLinkClass}>
            Winkelwagen
          </Link>
          <Link href="/favorites" className={mobileLinkClass}>
            Favorieten
          </Link>
        </div>
        {user ? (
          <>
            <div className="my-2 border-t border-[var(--border)]" />
            <Link href="/profile" className={mobileLinkClass}>
              Profiel
            </Link>
            <Link href="/dashboard" className={mobileLinkClass}>
              Dashboard
            </Link>
            <form action={logoutAction}>
              <button type="submit" className={`${mobileLinkClass} w-full text-left`}>
                Uitloggen
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="my-2 border-t border-[var(--border)]" />
            <Link href="/login" className={mobileLinkClass}>
              Inloggen
            </Link>
          </>
        )}
      </nav>
    </details>
  );
}
