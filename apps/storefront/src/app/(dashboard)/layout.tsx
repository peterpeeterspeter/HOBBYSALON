import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-semibold text-[var(--foreground)]">
            Hobbysalon
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:text-[var(--accent)]">
              Dashboard
            </Link>
            <Link href="/dashboard/creator" className="hover:text-[var(--accent)]">
              Creator
            </Link>
            <Link href="/dashboard/products" className="hover:text-[var(--accent)]">
              Producten
            </Link>
            <Link href="/dashboard/workshops" className="hover:text-[var(--accent)]">
              Workshops
            </Link>
            <Link href="/dashboard/events" className="hover:text-[var(--accent)]">
              Events
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
