"use server";

import { revalidatePath } from "next/cache";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import {
  EVENT_EXHIBITS_AT_RELATION,
  EVENT_STANDHOUDER_ROLE,
  isEligibleStandhouder,
} from "@/lib/platform/event-standhouder";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getEligibleCreatorContext(): Promise<
  | { ok: true; creator: { id: string; slug: string } }
  | { ok: false; error: string }
> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Meld je eerst aan om je aanwezigheid te bevestigen." };
  }

  const [creator, registration] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
  ]);

  if (!creator) {
    return {
      ok: false,
      error: "Maak eerst een makerprofiel aan om als standhouder te RSVP’en.",
    };
  }

  if (
    !isEligibleStandhouder({
      creatorTypes: creator.creator_types,
      roles: registration.roles,
    })
  ) {
    return {
      ok: false,
      error:
        "Alleen makers en workshopgevers kunnen zich als standhouder bevestigen.",
    };
  }

  return { ok: true, creator };
}

export async function rsvpEventStandhouderAction(input: {
  eventId: string;
}): Promise<ActionResult> {
  const context = await getEligibleCreatorContext();
  if (!context.ok) return context;

  const supabase = createPlatformClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, is_active")
    .eq("id", input.eventId)
    .maybeSingle();

  if (eventError || !event || !event.is_active) {
    return { ok: false, error: "Event niet gevonden of niet actief." };
  }

  const { error: rosterError } = await supabase.from("event_creators").upsert(
    {
      event_id: event.id,
      creator_id: context.creator.id,
      role: EVENT_STANDHOUDER_ROLE,
    },
    { onConflict: "event_id,creator_id,role" }
  );

  if (rosterError) {
    console.error("event_creators upsert failed:", rosterError);
    return { ok: false, error: "RSVP mislukt. Probeer het later opnieuw." };
  }

  const { data: existingLinks } = await supabase
    .from("entity_links")
    .select("id")
    .eq("source_entity_type", "creator")
    .eq("source_entity_id", context.creator.id)
    .eq("target_entity_type", "event")
    .eq("target_entity_id", event.id)
    .eq("relation_type", EVENT_EXHIBITS_AT_RELATION)
    .limit(1);

  if (!existingLinks?.length) {
    const { error: linkError } = await supabase.from("entity_links").insert({
      source_entity_type: "creator",
      source_entity_id: context.creator.id,
      target_entity_type: "event",
      target_entity_id: event.id,
      relation_type: EVENT_EXHIBITS_AT_RELATION,
      weight: 1,
    });
    if (linkError) {
      console.error("entity_links exhibits_at insert failed:", linkError);
    }
  }

  revalidatePath(`/agenda/${event.slug}`);
  revalidatePath(`/event/${event.slug}`);
  revalidatePath(`/creator/${context.creator.slug}`);
  revalidatePath("/dashboard/events");
  return { ok: true };
}

export async function cancelEventStandhouderRsvpAction(input: {
  eventId: string;
}): Promise<ActionResult> {
  const context = await getEligibleCreatorContext();
  if (!context.ok) return context;

  const supabase = createPlatformClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, slug")
    .eq("id", input.eventId)
    .maybeSingle();

  if (!event) {
    return { ok: false, error: "Event niet gevonden." };
  }

  const { error: rosterError } = await supabase
    .from("event_creators")
    .delete()
    .eq("event_id", event.id)
    .eq("creator_id", context.creator.id)
    .eq("role", EVENT_STANDHOUDER_ROLE);

  if (rosterError) {
    console.error("event_creators delete failed:", rosterError);
    return { ok: false, error: "RSVP annuleren mislukt." };
  }

  await supabase
    .from("entity_links")
    .delete()
    .eq("source_entity_type", "creator")
    .eq("source_entity_id", context.creator.id)
    .eq("target_entity_type", "event")
    .eq("target_entity_id", event.id)
    .eq("relation_type", EVENT_EXHIBITS_AT_RELATION);

  revalidatePath(`/agenda/${event.slug}`);
  revalidatePath(`/event/${event.slug}`);
  revalidatePath(`/creator/${context.creator.slug}`);
  revalidatePath("/dashboard/events");
  return { ok: true };
}

export async function getStandhouderRsvpState(input: {
  eventId: string;
  creatorId: string;
}): Promise<boolean> {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("event_creators")
    .select("id")
    .eq("event_id", input.eventId)
    .eq("creator_id", input.creatorId)
    .eq("role", EVENT_STANDHOUDER_ROLE)
    .maybeSingle();
  return Boolean(data);
}
