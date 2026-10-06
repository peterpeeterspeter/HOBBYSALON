"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/beheer/rollen", label: "Rolaanvragen" },
  { href: "/beheer/community", label: "Communityprojecten" },
  { href: "/beheer/materialen", label: "Materialen & feeds" },
];

export function BeheerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Beheer" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-2 px-1">
        {ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-12 items-center rounded-xl px-4 text-lg font-semibold",
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--foreground)] hover:bg-[var(--section-alt)]"
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
