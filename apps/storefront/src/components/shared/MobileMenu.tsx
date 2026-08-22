"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { ACCOUNT_NAV } from "@/config/nav";

type NavItem = { href: string; label: string };

type MobileMenuProps = {
  mainLinks: NavItem[];
  inspiratieLinks: NavItem[];
  user: boolean;
  aanbodNav?: { href: string; label: string } | null;
  mobileLinkClass: string;
  iconBtnClass: string;
};

export function MobileMenu({
  mainLinks,
  inspiratieLinks,
  user,
  aanbodNav = null,
  mobileLinkClass,
  iconBtnClass,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="relative 2xl:hidden">
      <button
        ref={buttonRef}
        type="button"
        className={iconBtnClass}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Menu sluiten" : "Menu openen"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/25"
            aria-label="Menu sluiten"
            onClick={closeMenu}
          />
          <nav
            id={panelId}
            ref={panelRef}
            aria-label="Mobiele navigatie"
            className="fixed right-4 top-[3.75rem] z-[70] w-[min(18rem,calc(100vw-2rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg"
          >
            <form
              action="/zoeken"
              method="GET"
              role="search"
              className="mb-2 px-2 pt-1"
              onSubmit={closeMenu}
            >
              <label htmlFor="mobile-zoeken-q" className="sr-only">
                Zoek overal op Hobbysalon
              </label>
              <input
                id="mobile-zoeken-q"
                type="search"
                name="q"
                placeholder="Zoek workshops, materialen…"
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[15px] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </form>

            <div className="space-y-0.5">
              {mainLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={mobileLinkClass}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {inspiratieLinks.length > 0 ? (
              <>
                <p className="mt-3 px-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Inspiratie
                </p>
                <div className="mt-1 space-y-0.5">
                  {inspiratieLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={mobileLinkClass}
                      onClick={closeMenu}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </>
            ) : null}

            <div className="my-2 border-t border-[var(--border)]" />
            <div className="space-y-0.5">
              <Link href="/cart" className={mobileLinkClass} onClick={closeMenu}>
                Winkelwagen
              </Link>
              <Link href="/favorites" className={mobileLinkClass} onClick={closeMenu}>
                Favorieten
              </Link>
            </div>

            {user ? (
              <>
                <p className="mt-3 px-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Account
                </p>
                <div className="mt-1 space-y-0.5">
                  <Link href={ACCOUNT_NAV.profile.href} className={mobileLinkClass} onClick={closeMenu}>
                    {ACCOUNT_NAV.profile.label}
                  </Link>
                  {aanbodNav ? (
                    <Link href={aanbodNav.href} className={mobileLinkClass} onClick={closeMenu}>
                      {aanbodNav.label}
                    </Link>
                  ) : null}
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className={`${mobileLinkClass} w-full text-left`}
                      onClick={closeMenu}
                    >
                      Uitloggen
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <div className="my-2 border-t border-[var(--border)]" />
                <Link href="/register" className={mobileLinkClass} onClick={closeMenu}>
                  Registreer
                </Link>
                <Link href="/login" className={mobileLinkClass} onClick={closeMenu}>
                  Inloggen
                </Link>
              </>
            )}
          </nav>
        </>
      ) : null}
    </div>
  );
}
