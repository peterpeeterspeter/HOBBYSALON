"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type DashboardNavItem = {
  href: string;
  label: string;
  badge?: number;
};

type DashboardNavProps = {
  items: DashboardNavItem[];
};

export function DashboardNav({ items }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className="flex flex-wrap items-center gap-1 sm:gap-2"
    >
      {items.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badge =
          typeof item.badge === "number" && item.badge > 0 ? item.badge : null;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                : "text-[var(--foreground)] hover:bg-[var(--background)] hover:text-[var(--accent)]"
            )}
          >
            {item.label}
            {badge !== null && (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[var(--accent-foreground)]"
                aria-label={`${badge} nieuwe aanvragen`}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
