import Link from "next/link";
import { cn } from "@/lib/utils";

type AccountSideSwitchProps = {
  active: "hobby" | "aanbod";
};

/**
 * One account, two sides: what you do as a hobbyist and what you offer.
 * Shown in the dashboard header so users always know where they are.
 */
export function AccountSideSwitch({ active }: AccountSideSwitchProps) {
  const sides = [
    { key: "hobby" as const, href: "/profile", label: "Mijn Hobbysalon" },
    { key: "aanbod" as const, href: "/dashboard", label: "Mijn aanbod" },
  ];

  return (
    <nav
      aria-label="Kies onderdeel van je account"
      className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--background)] p-1"
    >
      {sides.map((side) => {
        const isActive = side.key === active;
        return (
          <Link
            key={side.key}
            href={side.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg px-4 text-base font-semibold transition-colors",
              isActive
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            {side.label}
          </Link>
        );
      })}
    </nav>
  );
}
