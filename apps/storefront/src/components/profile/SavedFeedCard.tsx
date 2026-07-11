import Link from "next/link";
import { CardShell } from "@/components/ui/card-shell";
import { StartSavedProjectButton } from "./StartSavedProjectButton";
import type { FavoriteFeedItem } from "@/lib/profile/favorite-feed";

export function SavedFeedCard({ item }: { item: FavoriteFeedItem }) {
  return <CardShell variant="interactive" padding="md" className="flex h-full flex-col">
    <Link href={item.href} className="block">
      {item.imageUrl ? <img src={item.imageUrl} alt="" className="-mx-4 -mt-4 mb-3 aspect-video w-[calc(100%+2rem)] rounded-t-lg object-cover" /> : <div className="-mx-4 -mt-4 mb-3 aspect-video w-[calc(100%+2rem)] rounded-t-lg bg-[var(--section-highlight)]" />}
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{item.label}</p>
      <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-[var(--foreground)]">{item.title}</h3>
      {item.subtitle && <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{item.subtitle}</p>}
    </Link>
    {item.canStartProject && <div className="mt-4"><StartSavedProjectButton entityType={item.entityType as "article" | "project"} entityId={item.id} compact /></div>}
  </CardShell>;
}
