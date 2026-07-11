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

  const [productCount, workshopCount, eventCount] = creator
    ? await Promise.all([
        getCount("products", "creator_id", creator.id),
        getCount("workshops", "creator_id", creator.id),
        getCount("events", "organizer_creator_id", creator.id),
      ])
    : [0, 0, 0];

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--hero-bg)] p-6 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">Creator dashboard</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">Je creatieve overzicht</h1>
        <p className="mt-2 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">Beheer je profiel, aanbod en workshops. Kies hieronder de volgende stap die je vandaag wilt zetten.</p>
      </header>

      {!creator ? (
        <CardShell variant="default" padding="lg">
          <p className="text-lg font-semibold text-[var(--foreground)]">Begin met je creator-profiel</p>
          <p className="mt-2 max-w-xl leading-relaxed text-[var(--muted)]">Je profiel is de basis voor workshops, events en producten. Vul eerst je naam, locatie en creatieve aanbod aan.</p>
          <Button asChild className="mt-5">
            <Link href="/dashboard/creator">Creator-profiel instellen</Link>
          </Button>
        </CardShell>
      ) : (
        <GridLayout cols={3}>
          <CardShell variant="default" padding="lg">
            <p className="text-sm font-semibold text-[var(--muted)]">PRODUCTEN</p>
            <p className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">{productCount}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Materialen en handgemaakte creaties die je aanbiedt.</p>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/dashboard/products">Producten beheren</Link>
            </Button>
          </CardShell>
          <CardShell variant="default" padding="lg">
            <p className="text-sm font-semibold text-[var(--muted)]">WORKSHOPS</p>
            <p className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">{workshopCount}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Lessen en sessies die deelnemers kunnen ontdekken.</p>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/dashboard/workshops">Workshops beheren</Link>
            </Button>
          </CardShell>
          <CardShell variant="default" padding="lg">
            <p className="text-sm font-semibold text-[var(--muted)]">EVENTS</p>
            <p className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">{eventCount}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Markten, open ateliers en creatieve dagen die je organiseert.</p>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/dashboard/events">Events beheren</Link>
            </Button>
          </CardShell>
        </GridLayout>
      )}
    </section>
  );
}
