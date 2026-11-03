import Link from "next/link";
import { Check, SlidersHorizontal } from "lucide-react";

export type FilterGroupOption = { value: string; label: string; n: number; href: string; active: boolean };
export type FilterGroup = { title: string; options: FilterGroupOption[] };

type Props = {
  groups: FilterGroup[];
  featured: { n: number; href: string; active: boolean } | null;
  activeCount: number;
  clearHref: string;
};

const VISIBLE = 6;

/**
 * Filters as plain links with counts: one tap applies a filter, no apply
 * button. Server rendered, so every state is a shareable URL.
 */
export function MaterialsFilterPanel({ groups, featured, activeCount, clearHref }: Props) {
  const body = (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <Group key={group.title} group={group} />
      ))}
      {featured && featured.n > 0 ? (
        <Link
          href={featured.href}
          aria-current={featured.active ? "true" : undefined}
          className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-base font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          <span
            className={`flex size-6 items-center justify-center rounded border-2 ${
              featured.active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)]"
            }`}
            aria-hidden
          >
            {featured.active ? <Check size={16} /> : null}
          </span>
          Alleen uitgelicht
          <span className="ml-auto text-[var(--muted)]">{featured.n}</span>
        </Link>
      ) : null}
      {activeCount > 0 ? (
        <Link href={clearHref} className="inline-flex min-h-12 items-center text-base font-semibold text-[var(--accent-hover)] underline-offset-4 hover:underline">
          Wis alle filters
        </Link>
      ) : null}
    </div>
  );

  return (
    <aside aria-label="Filters" className="w-full lg:w-72 lg:shrink-0">
      <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-lg font-semibold text-[var(--foreground)]">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal size={20} aria-hidden />
            Filters{activeCount ? ` (${activeCount})` : ""}
          </span>
          <span className="text-base text-[var(--accent-hover)] group-open:hidden">Openen</span>
          <span className="hidden text-base text-[var(--accent-hover)] group-open:inline">Sluiten</span>
        </summary>
        <div className="border-t border-[var(--border)] px-4 py-6">{body}</div>
      </details>
      <div className="hidden lg:sticky lg:top-24 lg:block">{body}</div>
    </aside>
  );
}

function Group({ group }: { group: FilterGroup }) {
  const visible = group.options.slice(0, VISIBLE);
  const more = group.options.slice(VISIBLE);
  const activeHidden = more.find((option) => option.active);
  return (
    <fieldset>
      <legend className="mb-3 text-lg font-semibold text-[var(--foreground)]">{group.title}</legend>
      <ul className="flex flex-col gap-1">
        {visible.map((option) => <Row key={option.value} option={option} />)}
        {activeHidden ? <Row option={activeHidden} /> : null}
      </ul>
      {more.length > 0 ? (
        <details className="mt-1">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-[var(--accent-hover)]">
            Toon nog {more.length}
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {more.filter((option) => option !== activeHidden).map((option) => <Row key={option.value} option={option} />)}
          </ul>
        </details>
      ) : null}
    </fieldset>
  );
}

function Row({ option }: { option: FilterGroupOption }) {
  return (
    <li>
      <Link
        href={option.href}
        aria-current={option.active ? "true" : undefined}
        className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          option.active
            ? "bg-[var(--section-highlight)] font-semibold text-[var(--foreground)]"
            : "text-[var(--foreground)] hover:bg-[var(--section-alt)]"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          {option.active ? <Check size={18} aria-hidden className="text-[var(--accent-hover)]" /> : null}
          {option.label}
        </span>
        <span className="text-[var(--muted)]">{option.n}</span>
      </Link>
    </li>
  );
}
