import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  CREATOR_INTENT_CHIPS,
  type CreatorIntent,
} from "@/lib/creators/creators-directory-helpers";

type CreatorsIntentChipsProps = {
  activeIntent?: CreatorIntent | null;
  buildHref: (overrides: Record<string, string | undefined>) => string;
};

export function CreatorsIntentChips({
  activeIntent,
  buildHref,
}: CreatorsIntentChipsProps) {
  return (
    <section className="mb-5" aria-label="Wat zoek je?">
      <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
        Wat zoek je?
      </h2>
      <div className="flex flex-wrap gap-2">
        {CREATOR_INTENT_CHIPS.map((chip) => {
          const active = activeIntent === chip.intent;
          return (
            <Link
              key={chip.intent}
              href={buildHref({
                intent: active ? undefined : chip.intent,
                page: undefined,
              })}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold transition-colors",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
              )}
              aria-current={active ? "true" : undefined}
            >
              {chip.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
