import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CardShell } from "@/components/ui/card-shell";
import type { ToolSummary } from "@/lib/tools/registry";

type ToolCardProps = {
  tool: ToolSummary;
  /** Show the category label as an eyebrow (used outside grouped sections). */
  showCategory?: boolean;
};

/**
 * Presentational card for a single tool. Plain markup + Link, so it works in
 * both server (related tools) and client (tools browser) component trees.
 */
export function ToolCard({ tool, showCategory = false }: ToolCardProps) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group block h-full rounded-[0.85rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-2"
    >
      <CardShell
        variant="interactive"
        padding="lg"
        className="flex h-full flex-col"
      >
        {showCategory ? (
          <span className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
            {tool.categoryLabel}
          </span>
        ) : null}
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold leading-snug text-[var(--foreground)]">
          {tool.title}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-base leading-relaxed text-[var(--muted)]">
          {tool.description}
        </p>
        <span className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-[var(--accent)]">
          Openen
          <ArrowRight
            size={16}
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
          />
        </span>
      </CardShell>
    </Link>
  );
}
