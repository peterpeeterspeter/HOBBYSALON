"use client";

import Link from "next/link";

export function Header() {
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
            href="/crochet"
            className="text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Crochet
          </Link>
          <Link
            href="/knitting"
            className="text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Breien
          </Link>
          <Link
            href="/pottery"
            className="text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Keramiek
          </Link>
          <Link
            href="/creators"
            className="text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            Creators
          </Link>
        </nav>
      </div>
    </header>
  );
}
