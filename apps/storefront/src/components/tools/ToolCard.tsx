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
    <Link href={`/tools/${tool.slug}`} className="block h-full">
      <CardShell variant="interactive" padding="lg" className="flex h-full flex-col">
        {showCategory && (
          <span className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
            {tool.categoryLabel}
          </span>
        )}
        <h3 className="font-[family-name:var(--font-heading)] font-bold text-[var(--foreground)]">
          {tool.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">
          {tool.description}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
          Openen
          <ArrowRight
            size={15}
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </CardShell>
    </Link>
  );
}
