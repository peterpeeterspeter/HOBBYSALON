import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { completeSavedProjectAction, toggleSavedProjectItemAction } from "@/app/actions/saved-projects";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { CardShell } from "@/components/ui/card-shell";
import { getAuthUser } from "@/lib/auth/session";
import { createPlatformClient } from "@/lib/platform/client";
import { groupProjectRequirements } from "@/lib/profile/project-requirements";
import { getProjectRunState, isProjectReadyToComplete } from "@/lib/profile/project-run-state";
import { getSavedProjectSource, isStartableFavoriteType, type SavedProjectItem } from "@/lib/profile/saved-project-source";

type Props = { params: Promise<{ entityType: string; entityId: string }> };

type ItemToggleProps = {
  item: SavedProjectItem;
  entityType: string;
  entityId: string;
  done: boolean;
  actionLabel: string;
};

function ItemToggle({ item, entityType, entityId, done, actionLabel }: ItemToggleProps) {
  return (
    <CardShell variant="default" padding="md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <form action={toggleSavedProjectItemAction}>
            <input type="hidden" name="entity_type" value={entityType} />
            <input type="hidden" name="entity_id" value={entityId} />
            <input type="hidden" name="item_key" value={item.key} />
            <input type="hidden" name="completed" value={done ? "true" : "false"} />
            <button
              type="submit"
              aria-label={done ? `${item.title} opnieuw openen` : `${item.title} bevestigen`}
              className={`mt-0.5 min-h-9 min-w-9 rounded-full border text-sm font-bold transition-colors active:translate-y-px ${done ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"}`}
            >
              {done ? "✓" : ""}
            </button>
          </form>
          <div>
            <p className={`font-semibold ${done ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>{item.title}</p>
            {item.detail && <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 pl-12 sm:pl-0">
          <span className={`text-sm font-semibold ${done ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>{done ? actionLabel : "Nog nodig"}</span>
          {item.href && <Link href={item.href} className="text-sm font-semibold text-[var(--accent)] underline underline-offset-4 hover:no-underline">Bekijk</Link>}
        </div>
      </div>
    </CardShell>
  );
}

function DiscoveryList({ items, title, description }: { items: SavedProjectItem[]; title: string; description: string }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      <p className="mt-1 text-[var(--muted)]">{description}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <CardShell key={item.key} variant="default" padding="md">
            <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
            {item.detail && <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>}
            {item.href && <Link href={item.href} className="mt-3 inline-block text-sm font-semibold text-[var(--accent)] underline underline-offset-4 hover:no-underline">Bekijk aanbod</Link>}
          </CardShell>
        ))}
      </div>
    </section>
  );
}

export default async function SavedProjectRunPage({ params }: Props) {
  const { entityType, entityId } = await params;
  if (!isStartableFavoriteType(entityType as never)) notFound();

  const user = await getAuthUser();
  if (!user) redirect(`/login?next=/profile/start/${entityType}/${entityId}`);

  const source = await getSavedProjectSource(entityType as "article" | "project", entityId);
  if (!source) notFound();

  const supabase = createPlatformClient();
  const { data: favorite } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (!favorite) redirect("/favorites");

  const { data: events } = await supabase
    .from("user_activity_log")
    .select("event_name,occurred_at,metadata")
    .eq("user_id", user.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .in("event_name", ["project_started", "project_item_completed", "project_item_reopened", "project_completed"])
    .order("occurred_at", { ascending: true });

  const grouped = groupProjectRequirements(source.items);
  const requiredKeys = [...grouped.materials, ...grouped.steps].map((item) => item.key);
  const state = getProjectRunState(
    (events ?? []).map((event) => ({
      eventName: event.event_name,
      occurredAt: event.occurred_at,
      itemKey: (event.metadata as Record<string, unknown> | null)?.item_key as string | null ?? null,
    })),
    requiredKeys
  );
  const readyToComplete = isProjectReadyToComplete(state.completedItemKeys, requiredKeys);

  return (
    <PageLayout title={source.title} description={source.description ?? "Jouw persoonlijke projectoverzicht."} breadcrumbs={[{ label: "Mijn profiel", href: "/profile" }, { label: "Project starten" }]}>
      <CardShell variant="default" padding="lg" className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {source.imageUrl && <img src={source.imageUrl} alt="" className="h-32 w-full rounded-lg object-cover sm:w-48" />}
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">{state.status === "completed" ? "Afgerond" : "Jouw maakproject"}</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{state.progressPercent}% voorbereid</h2>
            <p className="mt-1 max-w-2xl text-[var(--muted)]">Bevestig wat je al in huis hebt. De graph toont daarna passende materialen, workshops en momenten om verder te gaan.</p>
          </div>
        </div>
      </CardShell>

      <section>
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Dit heb je nodig</h2>
        <p className="mt-1 text-[var(--muted)]">Vink elk materiaal af zodra je het in huis hebt. Nog iets nodig? Bekijk het aanbod dat bij dit project is gekoppeld.</p>
        {grouped.materials.length ? <div className="mt-4 space-y-3">{grouped.materials.map((item) => <ItemToggle key={item.key} item={item} entityType={entityType} entityId={entityId} done={state.completedItemKeys.has(item.key)} actionLabel="In huis" />)}</div> : <CardShell variant="default" padding="md" className="mt-4"><p className="text-[var(--muted)]">Voor dit project zijn nog geen materialen in de graph gekoppeld.</p></CardShell>}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Aan de slag</h2>
        <p className="mt-1 text-[var(--muted)]">Vink een stap af wanneer je ermee klaar bent.</p>
        {grouped.steps.length ? <div className="mt-4 space-y-3">{grouped.steps.map((item) => <ItemToggle key={item.key} item={item} entityType={entityType} entityId={entityId} done={state.completedItemKeys.has(item.key)} actionLabel="Klaar" />)}</div> : <CardShell variant="default" padding="md" className="mt-4"><p className="text-[var(--muted)]">Dit idee heeft nog geen stappen. Maak je eigen project om je stappen toe te voegen.</p></CardShell>}
      </section>

      <DiscoveryList items={grouped.workshops} title="Leer dit in een workshop" description="Deze workshops zijn via de graph aan jouw project gekoppeld." />
      <DiscoveryList items={grouped.events} title="Ontdek het in het echt" description="Ga langs bij een markt of evenement dat bij dit project past." />

      {state.status !== "completed" && <div className="mt-8"><form action={completeSavedProjectAction}><input type="hidden" name="entity_type" value={entityType} /><input type="hidden" name="entity_id" value={entityId} /><Button type="submit" disabled={!readyToComplete}>Project afronden</Button></form>{!readyToComplete && <p className="mt-2 text-sm text-[var(--muted)]">Bevestig eerst je materialen en stappen om je afrondbadge te verdienen.</p>}</div>}
      {state.status === "completed" && <CardShell variant="default" padding="lg" className="mt-8"><h2 className="text-xl font-semibold text-[var(--foreground)]">Mooi gedaan!</h2><p className="mt-1 text-[var(--muted)]">Je project is afgerond. Je Hobbypaspoort werkt je voortgang en badge bij.</p><Link href="/profile" className="mt-3 inline-block font-semibold text-[var(--accent)] hover:underline">Naar mijn profiel</Link></CardShell>}
    </PageLayout>
  );
}
