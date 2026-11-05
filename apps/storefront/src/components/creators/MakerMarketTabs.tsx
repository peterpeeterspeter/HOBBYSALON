import Link from "next/link";

type Tab = { key: "maker" | "destash"; label: string; description: string; n: number; href: string; active: boolean };

/** Two clear doors: finished work to buy, or leftover materials. */
export function MakerMarketTabs({ tabs }: { tabs: Tab[] }) {
  return (
    <nav aria-label="Soort aanbod" className="grid gap-3 sm:grid-cols-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`flex min-h-20 flex-col justify-center rounded-2xl border-2 px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
            tab.active
              ? "border-[var(--accent)] bg-[var(--section-highlight)]"
              : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
          }`}
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-xl font-bold text-[var(--foreground)]">{tab.label}</span>
            <span className="text-lg font-semibold text-[var(--muted)]">{tab.n}</span>
          </span>
          <span className="mt-1 text-base text-[var(--muted)]">{tab.description}</span>
        </Link>
      ))}
    </nav>
  );
}
