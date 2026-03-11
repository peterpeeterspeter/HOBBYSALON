import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--card)] py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            © {new Date().getFullYear()} Hobbysalon. Creatief platform voor hobbyisten.
          </p>
          <nav className="flex gap-4" aria-label="Footernavigatie">
            <Link
              href="/crochet"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Crochet
            </Link>
            <Link
              href="/knitting"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Breien
            </Link>
            <Link
              href="/pottery"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Keramiek
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
