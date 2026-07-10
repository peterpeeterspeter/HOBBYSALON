import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { createPlatformClient } from "@/lib/platform/client";
import { getSavedProjectSource, isStartableFavoriteType } from "@/lib/profile/saved-project-source";
import { getProjectRunState } from "@/lib/profile/project-run-state";
import { completeSavedProjectAction, toggleSavedProjectItemAction } from "@/app/actions/saved-projects";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";

type Props={params:Promise<{entityType:string;entityId:string}>};
export default async function SavedProjectRunPage({params}:Props){
 const {entityType,entityId}=await params; if(!isStartableFavoriteType(entityType as never)) notFound();
 const user=await getAuthUser(); if(!user) redirect(`/login?next=/profile/start/${entityType}/${entityId}`);
 const source=await getSavedProjectSource(entityType as "article"|"project",entityId); if(!source) notFound();
 const supabase=createPlatformClient(); const {data:favorite}=await supabase.from("favorites").select("id").eq("user_id",user.id).eq("entity_type",entityType).eq("entity_id",entityId).maybeSingle(); if(!favorite) redirect("/favorites");
 const {data:events}=await supabase.from("user_activity_log").select("event_name,occurred_at,metadata").eq("user_id",user.id).eq("entity_type",entityType).eq("entity_id",entityId).in("event_name",["project_started","project_item_completed","project_item_reopened","project_completed"]).order("occurred_at",{ascending:true});
 const state=getProjectRunState((events??[]).map((event)=>({eventName:event.event_name,occurredAt:event.occurred_at,itemKey:(event.metadata as Record<string,unknown>|null)?.item_key as string|null ?? null})),source.items.map((item)=>item.key));
 return <PageLayout title={source.title} description={source.description ?? "Jouw persoonlijke projectoverzicht."} breadcrumbs={[{label:"Mijn profiel",href:"/profile"},{label:"Project starten"}]}>
   <CardShell variant="default" padding="lg" className="mb-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {source.imageUrl && <img src={source.imageUrl} alt="" className="h-28 w-full rounded-lg object-cover sm:w-40"/>}
      <div><p className="text-sm font-semibold text-[var(--accent)]">{state.status==="completed"?"Afgerond":"Jouw project"}</p><h2 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{state.progressPercent}% klaar</h2><p className="mt-1 text-sm text-[var(--muted)]">Vink af wat je al geregeld of gedaan hebt. Je voortgang wordt bewaard.</p></div>
    </div>
   </CardShell>
   <section><h2 className="text-xl font-semibold text-[var(--foreground)]">Jouw checklist</h2>
    {source.items.length===0?<CardShell variant="default" padding="lg" className="mt-4"><p className="text-[var(--muted)]">Dit idee heeft nog geen concrete materialen of stappen. Voeg je eigen project toe zodra je wilt.</p></CardShell>:<div className="mt-4 space-y-3">{source.items.map((item)=>{const done=state.completedItemKeys.has(item.key);return <CardShell key={item.key} variant="default" padding="md"><div className="flex gap-3"><form action={toggleSavedProjectItemAction}><input type="hidden" name="entity_type" value={entityType}/><input type="hidden" name="entity_id" value={entityId}/><input type="hidden" name="item_key" value={item.key}/><input type="hidden" name="completed" value={done?"true":"false"}/><button type="submit" aria-label={done?"Opnieuw openen":"Als klaar markeren"} className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${done?"border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]":"border-[var(--border)]"}`}>{done?"✓":""}</button></form><div><p className={`font-semibold ${done?"text-[var(--muted)] line-through":"text-[var(--foreground)]"}`}>{item.title}</p>{item.detail&&<p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>}</div></div></CardShell>})}</div>}
   </section>
   {state.status!=="completed"&&<form action={completeSavedProjectAction} className="mt-6"><input type="hidden" name="entity_type" value={entityType}/><input type="hidden" name="entity_id" value={entityId}/><Button type="submit">Project afronden</Button></form>}
   {state.status==="completed"&&<CardShell variant="default" padding="lg" className="mt-6"><h2 className="text-xl font-semibold text-[var(--foreground)]">Mooi gedaan!</h2><p className="mt-1 text-[var(--muted)]">Je project is afgerond. Je Hobbypaspoort werkt je voortgang en badge bij.</p><Link href="/profile" className="mt-3 inline-block font-semibold text-[var(--accent)] hover:underline">Naar mijn profiel</Link></CardShell>}
 </PageLayout>
}
