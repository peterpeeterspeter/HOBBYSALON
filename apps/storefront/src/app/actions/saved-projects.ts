"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { createPlatformClient } from "@/lib/platform/client";
import { getSavedProjectSource, isStartableFavoriteType } from "@/lib/profile/saved-project-source";
import { getProjectRunState, isProjectReadyToComplete } from "@/lib/profile/project-run-state";
import { readProjectNote } from "@/lib/profile/project-notes";
import type { EntityType } from "@/types/platform";

function readStartableType(value: FormDataEntryValue | null): "article" | "project" {
  const type = String(value ?? "") as EntityType;
  if (!isStartableFavoriteType(type)) throw new Error("Dit bewaarde item kan nog niet als project worden gestart.");
  return type;
}
function readId(value: FormDataEntryValue | null): string { const id=String(value??""); if(!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Ongeldig projectitem."); return id; }
function sourceKey(type: string,id:string){ return `${type}:${id}`; }

async function requireSavedSource(type: "article" | "project", id: string) {
  const user=await getAuthUser(); if(!user) redirect(`/login?next=${encodeURIComponent(`/profile/start/${type}/${id}`)}`);
  const supabase=createPlatformClient();
  const {data}=await supabase.from("favorites").select("id").eq("user_id",user.id).eq("entity_type",type).eq("entity_id",id).maybeSingle();
  if(!data) throw new Error("Bewaar dit item eerst in je favorieten.");
  return { user, supabase };
}

async function logEvent(
  userId: string,
  eventName: string,
  type: "article" | "project",
  id: string,
  metadata: Record<string, unknown> = {}
) {
  const supabase = createPlatformClient();
  const { error } = await supabase.from("user_activity_log").insert({
    user_id: userId,
    event_name: eventName,
    entity_type: type,
    entity_id: id,
    path: `/profile/start/${type}/${id}`,
    metadata: {
      source_key: sourceKey(type, id),
      item_key: null,
      ...metadata,
    },
  });
  if (error) {
    console.error("user_activity_log insert failed", {
      eventName,
      type,
      id,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error("Je voortgang kon niet worden opgeslagen.");
  }
}

export async function startSavedProjectAction(formData:FormData){
  const type=readStartableType(formData.get("entity_type")); const id=readId(formData.get("entity_id")); const {user}=await requireSavedSource(type,id);
  await logEvent(user.id,"project_started",type,id); revalidatePath("/profile"); redirect(`/profile/start/${type}/${id}`);
}
export async function toggleSavedProjectItemAction(formData:FormData){
  const type=readStartableType(formData.get("entity_type")); const id=readId(formData.get("entity_id")); const itemKey=String(formData.get("item_key")??""); const completed=String(formData.get("completed")??"")==="true"; const {user}=await requireSavedSource(type,id);
  await logEvent(user.id,completed?"project_item_reopened":"project_item_completed",type,id,{item_key:itemKey}); revalidatePath(`/profile/start/${type}/${id}`); revalidatePath("/profile");
}
export async function updateSavedProjectNoteAction(formData:FormData){
  const type=readStartableType(formData.get("entity_type"));
  const id=readId(formData.get("entity_id"));
  const {user}=await requireSavedSource(type,id);
  const note=readProjectNote(formData.get("note"));
  await logEvent(user.id,"project_note_updated",type,id,{note});
  revalidatePath(`/profile/start/${type}/${id}`);
  revalidatePath("/profile");
}
export async function completeSavedProjectAction(formData:FormData){
  const type=readStartableType(formData.get("entity_type"));
  const id=readId(formData.get("entity_id"));
  const {user,supabase}=await requireSavedSource(type,id);
  const source=await getSavedProjectSource(type,id);
  if(!source) throw new Error("Dit project is niet meer beschikbaar.");
  const {data:events}=await supabase.from("user_activity_log").select("event_name,occurred_at,metadata").eq("user_id",user.id).eq("entity_type",type).eq("entity_id",id).in("event_name",["project_started","project_item_completed","project_item_reopened","project_completed","project_note_updated"]).order("occurred_at",{ascending:true});
  const requiredKeys=source.items.filter((item)=>item.kind==="material"||item.kind==="step").map((item)=>item.key);
  const state=getProjectRunState((events??[]).map((event)=>({eventName:event.event_name,occurredAt:event.occurred_at,itemKey:(event.metadata as Record<string,unknown>|null)?.item_key as string|null ?? null})),requiredKeys);
  if(state.status==="completed") return;
  if(!isProjectReadyToComplete(state.completedItemKeys,requiredKeys)) throw new Error("Bevestig eerst je benodigdheden en stappen.");
  await logEvent(user.id,"project_completed",type,id);
  revalidatePath(`/profile/start/${type}/${id}`);
  revalidatePath("/profile");
}
