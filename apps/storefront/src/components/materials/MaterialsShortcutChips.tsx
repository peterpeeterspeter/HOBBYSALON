import Link from "next/link";
import { cn } from "@/lib/utils";

export type MaterialsShortcut = {
  label: string;
  href: string;
  active?: boolean;
};

type MaterialsShortcutChipsProps = {
  shortcuts: MaterialsShortcut[];
  allHref: string;
};

export function MaterialsShortcutChips({
  shortcuts,
  allHref,
}: MaterialsShortcutChipsProps) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {shortcuts.map((shortcut) => (
        <Link
          key={shortcut.label}
          href={shortcut.href}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold transition-colors",
            shortcut.active
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
          )}
        >
          {shortcut.label}
        </Link>
      ))}
      <Link
        href={allHref}
        className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        Alle materialen
      </Link>
    </div>
  );
}
