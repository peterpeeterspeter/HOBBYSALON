"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveActiveNavHref } from "@/lib/auth/dashboard-access";

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
  const activeHref = resolveActiveNavHref(pathname);

  return (
    <nav aria-label="Mijn aanbod" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1 px-1 sm:gap-2">
        {items.map((item) => {
          const isActive = item.href === activeHref;
          const badge =
            typeof item.badge === "number" && item.badge > 0 ? item.badge : null;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-lg font-semibold transition-colors",
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--foreground)] hover:bg-[var(--section-alt)]"
                )}
              >
                {item.label}
                {badge !== null && (
                  <span
                    className={cn(
                      "inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-base font-bold leading-none",
                      isActive
                        ? "bg-[var(--accent-foreground)] text-[var(--accent-hover)]"
                        : "bg-[var(--accent-hover)] text-[var(--accent-foreground)]"
                    )}
                  >
                    {badge > 99 ? "99+" : badge}
                    <span className="sr-only"> nieuwe aanvragen</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
