import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ConversionReceipt } from "./conversions";
import { conversionGeneration, conversionUnavailable } from "./conversion-security.server";

type Client = Pick<SupabaseClient, "from">;
type Queue = (event: ConversionReceipt["event"], payload: Record<string, string>) => Promise<void>;
type ListingRow = { id: string; product_type: string; is_active: boolean; status: string };
type ListingResult = { data: ListingRow | null; error: unknown };

// The unique key is permanent: deactivation/reconfirmation never resets a claim.
async function claim(client: Client, event: string, entityId: string): Promise<boolean> {
  if (!await conversionGeneration()) return false;
  const { data, error } = await client.from("analytics_conversion_claims")
    .insert({ event, entity_id: entityId }).select("entity_id").maybeSingle();
  if (error && error.code !== "23505") conversionUnavailable();
  return !error && !!data?.entity_id;
}

export async function queueListingPublication(client: Client, result: ListingResult, queue: Queue): Promise<void> {
  try {
    const row = result.data;
    if (result.error || !row?.id || row.is_active !== true || row.status !== "active") return;
    if (row.product_type !== "handmade" && row.product_type !== "destash") return;
    if (await claim(client, "listing_published", row.id)) {
      await queue("listing_published", { listing_type: row.product_type });
    }
  } catch { /* Measurement failure cannot undo a saved listing or charge credits again. */ }
}

// Called only by register actions, never by login, recovery or OAuth initiation.
export async function rememberEmailRegistration(client: Client, user: User | null): Promise<void> {
  try {
    const generation = await conversionGeneration();
    if (!generation) return;
    if (!user?.id || !user.identities?.some(identity => identity.provider === "email")) return;
    const { error } = await client.from("analytics_signup_candidates").upsert({ user_id: user.id, generation }, {
      onConflict: "user_id", ignoreDuplicates: true,
    });
    if (error) conversionUnavailable();
  } catch { /* Signup must remain available without the analytics migration. */ }
}

export async function queueConfirmedRegistration(client: Client, user: User | null, queue: Queue): Promise<void> {
  try {
    const generation = await conversionGeneration();
    if (!generation) return;
    if (!user?.id || !user.email_confirmed_at || user.is_anonymous ||
        !user.identities?.some(identity => identity.provider === "email")) return;
    const { data, error } = await client.from("analytics_signup_candidates")
      .select("user_id").eq("user_id", user.id).eq("generation", generation).maybeSingle();
    if (error) conversionUnavailable();
    if (!error && data && await claim(client, "sign_up", user.id)) {
      await queue("sign_up", { method: "email" });
    }
  } catch { /* Optional analytics never blocks authentication. */ }
}

export async function queueConfirmedWorkshop(
  client: Client,
  result: { data: { id: string; workshop_id: string; status: string } | null; error: unknown },
  queue: Queue
): Promise<void> {
  try {
    const row = result.data;
    if (result.error || !row?.id || row.status !== "confirmed" || !row.workshop_id) return;
    if (await claim(client, "workshop_booking_registered", row.id)) {
      await queue("workshop_booking_registered", { workshop_id: row.workshop_id, actor_role: "organizer" });
    }
  } catch { /* Confirmation is business truth, not delivery to analytics. */ }
}

// Ignore conflicts: a resend must not overwrite a simultaneous first confirmation.
export async function requestLeadMagnetOptIn(
  client: Client, email: string, leadMagnetId: string, sourcePath: string
) {
  const inserted = await client.from("newsletter_opt_in_events").upsert({
    email, lead_magnet_id: leadMagnetId, source_path: sourcePath,
    status: "pending", consented_at: new Date().toISOString(),
  }, { onConflict: "email,lead_magnet_id", ignoreDuplicates: true });
  if (inserted.error) return inserted;
  return client.from("newsletter_opt_in_events").update({
    status: "pending", consented_at: new Date().toISOString(), source_path: sourcePath,
  }).eq("email", email).eq("lead_magnet_id", leadMagnetId).eq("status", "unsubscribed");
}

export async function confirmLeadMagnetOptIn(
  client: Client,
  email: string,
  leadMagnetId: string,
  confirmedAt: string,
  queue: Queue
) {
  const first = await client.from("newsletter_opt_in_events")
    .update({ status: "confirmed", confirmed_at: confirmedAt })
    .eq("email", email).eq("lead_magnet_id", leadMagnetId)
    .eq("status", "pending").is("confirmed_at", null)
    .select("id, source_path, confirmed_at").maybeSingle();

  if (first.error) return first;
  if (first.data) {
    if (first.data.id && typeof first.data.confirmed_at === "string" &&
        Number.isFinite(Date.parse(confirmedAt)) &&
        Date.parse(first.data.confirmed_at) === Date.parse(confirmedAt)) {
      try {
        await queue("newsletter_signup", { signup_source: "lead_magnet_form", opt_in_method: "double" });
      } catch { /* A confirmed subscription survives a receipt failure. */ }
    }
    return first;
  }

  const reconfirmed = await client.from("newsletter_opt_in_events")
    .update({ status: "confirmed" }).eq("email", email).eq("lead_magnet_id", leadMagnetId)
    .eq("status", "pending").not("confirmed_at", "is", null)
    .select("id, source_path, confirmed_at").maybeSingle();
  if (reconfirmed.error || reconfirmed.data) return reconfirmed;

  // A resend/retry may deliver the file again, but never changes the first confirmation.
  return client.from("newsletter_opt_in_events").select("id, source_path, confirmed_at")
    .eq("email", email).eq("lead_magnet_id", leadMagnetId)
    .eq("status", "confirmed").not("confirmed_at", "is", null).maybeSingle();
}
