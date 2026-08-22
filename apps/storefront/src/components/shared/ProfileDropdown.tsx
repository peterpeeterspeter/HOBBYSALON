"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ACCOUNT_NAV } from "@/config/nav";

type ProfileDropdownProps = {
  displayName: string | null;
  logoutAction: () => void | Promise<void>;
  aanbodNav?: { href: string; label: string } | null;
};

const itemClass =
  "inline-flex min-h-11 w-full items-center rounded-md px-3 text-[15px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--section-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function ProfileDropdown({
  displayName,
  logoutAction,
  aanbodNav = null,
}: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const label = displayName?.trim() || "Profiel";

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative hidden lg:block">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-h-11 max-w-[10rem] items-center gap-1 rounded-md px-3 py-2 text-[15px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <nav
          id={panelId}
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-[240px] rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-[var(--shadow-md)]"
        >
          <Link
            href={ACCOUNT_NAV.profile.href}
            className={itemClass}
            onClick={close}
          >
            {ACCOUNT_NAV.profile.label}
          </Link>
          {aanbodNav ? (
            <Link href={aanbodNav.href} className={itemClass} onClick={close}>
              {aanbodNav.label}
            </Link>
          ) : null}
          <div className="my-1 border-t border-[var(--border)]" />
          <form action={logoutAction}>
            <button type="submit" className={`${itemClass} text-left`}>
              Uitloggen
            </button>
          </form>
        </nav>
      ) : null}
    </div>
  );
}
