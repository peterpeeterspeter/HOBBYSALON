import { toggleFavoriteAction } from "@/app/actions/favorites";
import type { EntityType } from "@/types/platform";

type FavoriteToggleButtonProps = {
  entityType: EntityType;
  entityId: string;
  isFavorited: boolean;
  nextPath: string;
};

export function FavoriteToggleButton({
  entityType,
  entityId,
  isFavorited,
  nextPath,
}: FavoriteToggleButtonProps) {
  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <input type="hidden" name="next_path" value={nextPath} />
      <button
        type="submit"
        className="inline-flex items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]"
      >
        {isFavorited ? "Uit favorieten verwijderen" : "Bewaar als favoriet"}
      </button>
    </form>
  );
}
