"use server";

import { revalidatePath } from "next/cache";
import { createPlatformClient } from "@/lib/platform/client";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function submitEventVendorInquiryAction(input: {
  eventId: string;
  organizerCreatorId: string;
  businessName: string;
  contactName: string;
  email: string;
  message?: string;
}): Promise<ActionResult> {
  const supabase = createPlatformClient();

  const { error } = await supabase.from("event_vendor_inquiries").insert({
    event_id: input.eventId,
    organizer_creator_id: input.organizerCreatorId,
    business_name: input.businessName.trim(),
    contact_name: input.contactName.trim(),
    email: input.email.trim(),
    message: input.message?.trim() ?? null,
    status: "new",
  });

  if (error) {
    return { ok: false, error: "Aanmelding versturen mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/dashboard/events");
  return { ok: true };
}

export async function updateEventVendorInquiryStatusAction(input: {
  inquiryId: string;
  organizerCreatorId: string;
  status: "new" | "contacted" | "accepted" | "declined";
}): Promise<ActionResult> {
  const supabase = createPlatformClient();
  const { error } = await supabase
    .from("event_vendor_inquiries")
    .update({ status: input.status })
    .eq("id", input.inquiryId)
    .eq("organizer_creator_id", input.organizerCreatorId);

  if (error) {
    return { ok: false, error: "Status bijwerken mislukt." };
  }

  revalidatePath("/dashboard/events");
  return { ok: true };
}
