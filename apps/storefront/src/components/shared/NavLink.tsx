"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Extra classes when active */
  activeClassName?: string;
};

function NavLink({
  href,
  children,
  className,
  activeClassName = "text-[var(--accent)] border-b-[3px] border-[var(--accent)]",
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(className, isActive && activeClassName)}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

export { NavLink };
