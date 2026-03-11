import Link from "next/link";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";

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
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-[var(--foreground)]">
            Je hebt nog geen creator-profiel. Maak dit eerst aan.
          </p>
          <Link href="/dashboard/creator" className="mt-3 inline-block text-[var(--accent)] underline">
            Naar creator-profiel
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-sm text-[var(--muted)]">Producten</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{productCount}</p>
            <Link href="/dashboard/products" className="mt-2 inline-block text-sm text-[var(--accent)] underline">
              Beheren
            </Link>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-sm text-[var(--muted)]">Workshops</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{workshopCount}</p>
            <Link href="/dashboard/workshops" className="mt-2 inline-block text-sm text-[var(--accent)] underline">
              Beheren
            </Link>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-sm text-[var(--muted)]">Events</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{eventCount}</p>
            <Link href="/dashboard/events" className="mt-2 inline-block text-sm text-[var(--accent)] underline">
              Beheren
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
