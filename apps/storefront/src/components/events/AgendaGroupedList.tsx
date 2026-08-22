import { AgendaEventRow } from "./AgendaEventRow";
import type { Event } from "@/types/platform";
import type { AgendaGroup } from "@/lib/agenda/agenda-helpers";

type AgendaGroupedListProps = {
  groups: AgendaGroup<Event>[];
  /** Kept for API compatibility; listing Taste always uses editorial rows. */
  useRows?: boolean;
};

export function AgendaGroupedList({ groups }: AgendaGroupedListProps) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`agenda-group-${group.key}`}>
          <h3
            id={`agenda-group-${group.key}`}
            className="mb-2 font-[family-name:var(--font-heading)] text-xl font-bold tracking-[-0.03em] text-[var(--foreground)]"
          >
            {group.label}
          </h3>
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {group.events.map((event) => (
              <li key={event.id}>
                <AgendaEventRow event={event} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
