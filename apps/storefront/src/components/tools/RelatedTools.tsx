import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ToolCard } from "./ToolCard";
import type { ToolSummary } from "@/lib/tools/registry";

type RelatedToolsProps = {
  tools: ToolSummary[];
  categoryLabel: string;
};

/**
 * "More tools in this category" strip shown beneath a tool — keeps the
 * calculator pages cross-linked instead of dead-ending.
 */
export function RelatedTools({ tools, categoryLabel }: RelatedToolsProps) {
  if (tools.length === 0) return null;

  return (
    <section className="mt-12 border-t border-[var(--border)] pt-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
            Meer {categoryLabel.toLowerCase()}
          </h2>
          <span
            className="mt-2 block h-[3px] w-10 rounded-full bg-[var(--accent)]"
            aria-hidden
          />
        </div>
        <Link
          href="/tools"
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-1 font-medium text-[var(--accent)] hover:underline"
        >
          Alle tools
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
