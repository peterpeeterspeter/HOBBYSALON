import type { AgendaGroup } from "@/lib/agenda/agenda-helpers";
import type { WorkshopDiscoveryItem } from "@/lib/platform/queries/workshops";
import { WorkshopDiscoveryRow } from "./WorkshopDiscoveryCard";

type WorkshopsGroupedListProps = {
  groups: AgendaGroup<
    WorkshopDiscoveryItem & { starts_at: string; ends_at?: string | null }
  >[];
  /** Kept for API compatibility; Taste listing always uses editorial rows. */
  useRows?: boolean;
};

export function WorkshopsGroupedList({ groups }: WorkshopsGroupedListProps) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`ws-group-${group.key}`}>
          <h3
            id={`ws-group-${group.key}`}
            className="mb-2 font-[family-name:var(--font-heading)] text-xl font-bold tracking-[-0.03em] text-[var(--foreground)]"
          >
            {group.label}
          </h3>
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {group.events.map((workshop) => (
              <li key={workshop.id}>
                <WorkshopDiscoveryRow workshop={workshop} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
