import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { listFavoriteFeed } from "@/lib/profile/favorite-feed";
import { PageLayout } from "@/components/layout/page-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { FavoritesFeed } from "@/components/profile/FavoritesFeed";

export const metadata: Metadata = {
  title: "Favorieten | Hobbysalon",
  description: "Je opgeslagen ideeën, materialen, workshops en projecten op Hobbysalon.",
};

export default async function FavoritesPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/favorites");
  const feed = await listFavoriteFeed(user.id, 80);

  return <PageLayout title="Mijn bewaarde ideeën" description="Alles wat je bewaart, op één rustige plek. Start een patroon, artikel of project wanneer jij er klaar voor bent.">
    {feed.length === 0 ? <EmptyState image="emptyCrafts" title="Nog niets bewaard" description="Bewaar een patroon, artikel, workshop of materiaal om hier je persoonlijke ideeënfeed op te bouwen." action={{label:"Ontdek patronen",href:"/patronen"}} /> :
      <FavoritesFeed items={feed} />}
  </PageLayout>;
}
