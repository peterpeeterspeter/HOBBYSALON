import type { AgendaGroup } from "@/lib/agenda/agenda-helpers";
import type { WorkshopDiscoveryItem } from "@/lib/platform/queries/workshops";
import {
  WorkshopDiscoveryCard,
  WorkshopDiscoveryRow,
} from "./WorkshopDiscoveryCard";

type WorkshopsGroupedListProps = {
  groups: AgendaGroup<
    WorkshopDiscoveryItem & { starts_at: string; ends_at?: string | null }
  >[];
  useRows: boolean;
};

export function WorkshopsGroupedList({
  groups,
  useRows,
}: WorkshopsGroupedListProps) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`ws-group-${group.key}`}>
          <h3
            id={`ws-group-${group.key}`}
            className="mb-3 font-[family-name:var(--font-heading)] text-sm font-bold uppercase tracking-wide text-[var(--muted)]"
          >
            {group.label}
          </h3>
          {useRows ? (
            <ul className="flex flex-col gap-3">
              {group.events.map((workshop) => (
                <li key={workshop.id}>
                  <WorkshopDiscoveryRow workshop={workshop} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.events.map((workshop) => (
                <li key={workshop.id}>
                  <WorkshopDiscoveryCard workshop={workshop} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
