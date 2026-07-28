import { EventCard } from "@/components/cards";
import { AgendaEventRow } from "./AgendaEventRow";
import type { Event } from "@/types/platform";
import type { AgendaGroup } from "@/lib/agenda/agenda-helpers";

type AgendaGroupedListProps = {
  groups: AgendaGroup<Event>[];
  /** Use full-width rows instead of a card grid. */
  useRows: boolean;
};

export function AgendaGroupedList({ groups, useRows }: AgendaGroupedListProps) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`agenda-group-${group.key}`}>
          <h3
            id={`agenda-group-${group.key}`}
            className="mb-3 font-[family-name:var(--font-heading)] text-sm font-bold uppercase tracking-wide text-[var(--muted)]"
          >
            {group.label}
          </h3>
          {useRows ? (
            <ul className="flex flex-col gap-3">
              {group.events.map((event) => (
                <li key={event.id}>
                  <AgendaEventRow event={event} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.events.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
