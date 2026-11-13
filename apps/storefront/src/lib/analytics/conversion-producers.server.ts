import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversionReceipt } from "./conversions";

// Inject the existing receipt queue so these success boundaries can run offline.
type Queue = (event: ConversionReceipt["event"], payload: Record<string, string>) => Promise<void>;
type ListingRow = { id: string; product_type: string; is_active: boolean; status: string };
type ListingResult = { data: ListingRow | null; error: unknown };

async function queuePublishedRow(result: ListingResult, queue: Queue): Promise<void> {
  const row = result.data;
  if (result.error || !row?.id || row.is_active !== true || row.status !== "active") return;
  if (row.product_type !== "handmade" && row.product_type !== "destash") return;
  await queue("listing_published", { listing_type: row.product_type });
}

/** An INSERT returning an active row proves creation directly into publication. */
export async function queueCreatedListing(result: ListingResult, queue: Queue): Promise<void> {
  await queuePublishedRow(result, queue);
}

/**
 * Atomic pending + never-confirmed claim: concurrent/replayed confirmations cannot
 * both return the first transition. Resends retain confirmed_at in the request
 * action. A previously confirmed pending row can still receive its download,
 * without replacing its original confirmation time or generating a conversion.
 */
export async function confirmLeadMagnetOptIn(
  client: Pick<SupabaseClient, "from">,
  email: string,
  leadMagnetId: string,
  confirmedAt: string,
  queue: Queue
) {
  const first = await client
    .from("newsletter_opt_in_events")
    .update({ status: "confirmed", confirmed_at: confirmedAt })
    .eq("email", email)
    .eq("lead_magnet_id", leadMagnetId)
    .eq("status", "pending")
    .is("confirmed_at", null)
    .select("id, source_path, confirmed_at")
    .maybeSingle();

  if (first.error) return first;
  if (first.data) {
    // PostgreSQL serializes timestamptz with an offset, not necessarily the
    // request's ISO spelling (.000Z); compare the instant rather than the text.
    if (first.data.id && typeof first.data.confirmed_at === "string" &&
        Number.isFinite(Date.parse(confirmedAt)) &&
        Date.parse(first.data.confirmed_at) === Date.parse(confirmedAt)) {
      await queue("newsletter_signup", { signup_source: "lead_magnet_form", opt_in_method: "double" });
    }
    return first;
  }

  return client
    .from("newsletter_opt_in_events")
    .update({ status: "confirmed" })
    .eq("email", email)
    .eq("lead_magnet_id", leadMagnetId)
    .eq("status", "pending")
    .not("confirmed_at", "is", null)
    .select("id, source_path, confirmed_at")
    .maybeSingle();
}
