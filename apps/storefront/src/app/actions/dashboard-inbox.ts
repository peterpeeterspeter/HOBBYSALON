"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { withFlash } from "@/lib/dashboard/return-path";

const UUID = /^[0-9a-f-]{36}$/i;

/** Allowed statuses mirror the CHECK constraints on each table. */
const SOURCES = {
  creatie: {
    table: "product_inquiries",
    ownerColumn: "creator_id",
    path: "/dashboard/products",
    statuses: new Set(["new", "contacted", "accepted", "declined"]),
  },
  workshop: {
    table: "workshop_booking_requests",
    ownerColumn: "creator_id",
    path: "/dashboard/workshops",
    statuses: new Set(["new", "contacted", "confirmed", "cancelled"]),
  },
  event: {
    table: "event_vendor_inquiries",
    ownerColumn: "organizer_creator_id",
    path: "/dashboard/events",
    statuses: new Set(["new", "contacted", "accepted", "declined"]),
  },
} as const;

const STATUS_MESSAGE: Record<string, string> = {
  new: "Aanvraag terug op nieuw gezet.",
  contacted: "Aanvraag gemarkeerd als behandeld.",
  accepted: "Aanvraag geaccepteerd.",
  confirmed: "Boeking bevestigd.",
  declined: "Aanvraag afgewezen.",
  cancelled: "Boeking geannuleerd.",
};

/** Return to Vandaag, or to the item page of the same source. Never elsewhere. */
function resolveInboxReturn(raw: string, sourcePath: string | undefined): string {
  if (raw === "/dashboard") return raw;
  if (sourcePath && raw.startsWith(`${sourcePath}/`)) {
    const rest = raw.slice(sourcePath.length);
    if (/^\/[a-z0-9-]+$/i.test(rest)) return raw;
  }
  return "/dashboard";
}

/**
 * Update the status of any request (product question, workshop booking,
 * stand request). Ownership is enforced by matching the creator column.
 */
export async function updateInboxItemStatusAction(formData: FormData): Promise<void> {
  const source = String(formData.get("source") ?? "") as keyof typeof SOURCES;
  const config = SOURCES[source] as (typeof SOURCES)[keyof typeof SOURCES] | undefined;
  const returnPath = resolveInboxReturn(String(formData.get("return_to") ?? ""), config?.path);

  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const creator = await getCreatorByUserId(user.id);
  if (!creator) {
    redirect(withFlash(returnPath, "error", "Maak eerst je maker-pagina aan."));
  }

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!config || !UUID.test(id) || !config.statuses.has(status)) {
    redirect(withFlash(returnPath, "error", "Deze aanvraag kon niet worden bijgewerkt."));
  }

  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from(config.table)
    .update({ status })
    .eq("id", id)
    .eq(config.ownerColumn, creator.id)
    .select("id");

  if (error || !data?.length) {
    redirect(withFlash(returnPath, "error", "Deze aanvraag kon niet worden bijgewerkt."));
  }

  revalidatePath("/dashboard");
  revalidatePath(config.path);
  redirect(withFlash(returnPath, "success", STATUS_MESSAGE[status] ?? "Aanvraag bijgewerkt."));
}
