import Link from "next/link";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { GridLayout } from "@/components/layout/grid-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";

async function getCount(
  table: "products" | "workshops" | "events",
  field: "creator_id" | "organizer_creator_id",
  creatorId: string
): Promise<number> {
  const supabase = createPlatformClient();
  const { count } = await supabase
    .from(table)
    .select("id", { head: true, count: "exact" })
    .eq(field, creatorId);

  return count ?? 0;
}

export default async function DashboardHomePage() {
  const user = await getAuthUser();
  const creator = user ? await getCreatorByUserId(user.id) : null;

  const productCount = creator
    ? await getCount("products", "creator_id", creator.id)
    : 0;
  const workshopCount = creator
    ? await getCount("workshops", "creator_id", creator.id)
    : 0;
  const eventCount = creator
    ? await getCount("events", "organizer_creator_id", creator.id)
    : 0;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Dashboard</h1>
      <p className="mt-2 text-[var(--muted)]">
        Beheer je creator-profiel, producten, workshops en events.
      </p>

      {!creator ? (
        <CardShell variant="default" padding="lg">
          <p className="text-[var(--foreground)]">
            Je hebt nog geen creator-profiel. Maak dit eerst aan.
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-3">
            <Link href="/dashboard/creator">Naar creator-profiel</Link>
          </Button>
        </CardShell>
      ) : (
        <GridLayout cols={3}>
          <CardShell variant="default" padding="lg">
            <p className="text-sm text-[var(--muted)]">Producten</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{productCount}</p>
            <Button asChild variant="ghost" size="sm" className="mt-2">
              <Link href="/dashboard/products">Beheren</Link>
            </Button>
          </CardShell>
          <CardShell variant="default" padding="lg">
            <p className="text-sm text-[var(--muted)]">Workshops</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{workshopCount}</p>
            <Button asChild variant="ghost" size="sm" className="mt-2">
              <Link href="/dashboard/workshops">Beheren</Link>
            </Button>
          </CardShell>
          <CardShell variant="default" padding="lg">
            <p className="text-sm text-[var(--muted)]">Events</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{eventCount}</p>
            <Button asChild variant="ghost" size="sm" className="mt-2">
              <Link href="/dashboard/events">Beheren</Link>
            </Button>
          </CardShell>
        </GridLayout>
      )}
    </section>
  );
}
