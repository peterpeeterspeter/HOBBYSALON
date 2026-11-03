import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

type Option = { id: string; label: string; n: number };

type Props = {
  groups: Option[];
  subs: Option[];
  activeGroup: Option | null;
  activeSubId?: string;
  hrefForGroup: (id?: string) => string;
  hrefForSub: (id?: string) => string;
};

/**
 * Category overview for /materials. Without a choice: one tile per group
 * with stock. With a group: a way back and its subcategories as chips.
 * Groups without products stay hidden, so the page grows with the range.
 */
export function MaterialsCategoryBrowser({ groups, subs, activeGroup, activeSubId, hrefForGroup, hrefForSub }: Props) {
  if (!activeGroup) {
    if (groups.length === 0) return null;
    return (
      <nav aria-labelledby="categorie-titel" className="mb-10">
        <h2 id="categorie-titel" className="text-2xl font-bold text-[var(--foreground)]">
          Kies een categorie
        </h2>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={hrefForGroup(group.id)}
                className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span className="min-w-0">
                  <span className="block text-lg font-semibold leading-snug text-[var(--foreground)]">{group.label}</span>
                  <span className="block text-base text-[var(--muted)]">
                    {group.n === 1 ? "1 product" : `${group.n} producten`}
                  </span>
                </span>
                <ArrowRight size={20} aria-hidden className="shrink-0 text-[var(--accent-hover)]" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label={`Subcategorieën van ${activeGroup.label}`} className="mb-8">
      <Link
        href={hrefForGroup(undefined)}
        className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[var(--accent-hover)] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={18} aria-hidden />
        Alle categorieën
      </Link>
      <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">
        {activeGroup.label}
      </h2>
      {subs.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          <li>
            <Chip href={hrefForSub(undefined)} active={!activeSubId} label="Alles" n={activeGroup.n} />
          </li>
          {subs.map((sub) => (
            <li key={sub.id}>
              <Chip href={hrefForSub(sub.id)} active={activeSubId === sub.id} label={sub.label} n={sub.n} />
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}

function Chip({ href, active, label, n }: { href: string; active: boolean; label: string; n: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
      }`}
    >
      {label}
      <span className={active ? "opacity-80" : "text-[var(--muted)]"}>{n}</span>
    </Link>
  );
}
