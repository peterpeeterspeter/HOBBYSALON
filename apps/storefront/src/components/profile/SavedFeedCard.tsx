import Link from "next/link";
import { CardShell } from "@/components/ui/card-shell";
import { LANDING_IMAGES, getDomainPlaceholderImage } from "@/components/ui/ai-generated-image";
import { StartSavedProjectButton } from "./StartSavedProjectButton";
import type { FavoriteFeedItem } from "@/lib/profile/favorite-feed";

/** A craft photo instead of an empty block when the item has no image. */
function fallbackImage(item: FavoriteFeedItem): string {
  switch (item.entityType) {
    case "domain":
      return getDomainPlaceholderImage(item.href.replace(/^\//, "").split(/[/?#]/)[0] ?? "");
    case "article":
      return LANDING_IMAGES.placeholderArticle;
    case "workshop":
      return LANDING_IMAGES.placeholderWorkshop;
    case "event":
      return LANDING_IMAGES.placeholderEvent;
    case "product":
      return LANDING_IMAGES.placeholderProduct;
    case "creator":
      return LANDING_IMAGES.placeholderCreator;
    case "project":
      return LANDING_IMAGES.placeholderProject;
    default:
      return LANDING_IMAGES.placeholderDefault;
  }
}

export function SavedFeedCard({ item }: { item: FavoriteFeedItem }) {
  return <CardShell variant="interactive" padding="md" className="flex h-full flex-col">
    <Link href={item.href} className="block">
      <img src={item.imageUrl ?? fallbackImage(item)} alt="" className="-mx-4 -mt-4 mb-3 aspect-video w-[calc(100%+2rem)] rounded-t-lg object-cover" />
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-hover)]">{item.label}</p>
      <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-[var(--foreground)]">{item.title}</h3>
      {item.subtitle && <p className="mt-1 line-clamp-2 text-base text-[var(--muted)]">{item.subtitle}</p>}
    </Link>
    {item.canStartProject && <div className="mt-4"><StartSavedProjectButton entityType={item.entityType as "article" | "project"} entityId={item.id} compact /></div>}
  </CardShell>;
}
