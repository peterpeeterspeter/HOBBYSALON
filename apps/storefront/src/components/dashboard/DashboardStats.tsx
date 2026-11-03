import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type DashboardStat = {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  /** Draws attention, for example new inquiries waiting. */
  attention?: boolean;
};

/** A row of key numbers; each one opens the page behind it. */
export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  if (stats.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {stats.map(({ label, value, href, icon: Icon, attention }) => (
        <li key={label}>
          <Link
            href={href}
            className={`flex h-full flex-col justify-between gap-3 rounded-2xl border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              attention
                ? "border-[var(--accent)] bg-[var(--section-highlight)] hover:bg-[var(--card)]"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-base font-semibold text-[var(--muted)]">{label}</span>
              <Icon size={22} aria-hidden className="text-[var(--accent-hover)]" />
            </span>
            <span className="font-[family-name:var(--font-heading)] text-4xl font-bold tabular-nums text-[var(--foreground)]">
              {value}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
