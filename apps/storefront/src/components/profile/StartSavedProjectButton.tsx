import { startSavedProjectAction } from "@/app/actions/saved-projects";

type Props = { entityType: "article" | "project"; entityId: string; compact?: boolean };
export function StartSavedProjectButton({ entityType, entityId, compact }: Props) {
  return <form action={startSavedProjectAction}>
    <input type="hidden" name="entity_type" value={entityType} />
    <input type="hidden" name="entity_id" value={entityId} />
    <button type="submit" className={`inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px ${compact ? "w-full" : ""}`}>
      Start dit project
    </button>
  </form>;
}
