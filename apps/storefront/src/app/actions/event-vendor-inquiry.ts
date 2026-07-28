"use server";

import { revalidatePath } from "next/cache";
import { createPlatformClient } from "@/lib/platform/client";
import { sendEventVendorInquiryOrganizerEmail } from "@/lib/platform/notifications/event-vendor-inquiry-email";
import { resolveCreatorNotifyEmail } from "@/lib/platform/queries/product-inquiries";

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
  const businessName = input.businessName.trim();
  const contactName = input.contactName.trim();
  const email = input.email.trim();
  const message = input.message?.trim() ?? null;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, slug, organizer_creator_id")
    .eq("id", input.eventId)
    .eq("organizer_creator_id", input.organizerCreatorId)
    .maybeSingle();

  if (eventError || !event) {
    return { ok: false, error: "Event niet gevonden." };
  }

  const { error } = await supabase.from("event_vendor_inquiries").insert({
    event_id: input.eventId,
    organizer_creator_id: input.organizerCreatorId,
    business_name: businessName,
    contact_name: contactName,
    email,
    message,
    status: "new",
  });

  if (error) {
    return { ok: false, error: "Aanmelding versturen mislukt. Probeer het opnieuw." };
  }

  const { data: organizer } = await supabase
    .from("creators")
    .select("display_name, email, user_id")
    .eq("id", input.organizerCreatorId)
    .maybeSingle();

  const organizerEmail = await resolveCreatorNotifyEmail({
    creatorId: input.organizerCreatorId,
    userId: organizer?.user_id ?? null,
    profileEmail: organizer?.email ?? null,
  });

  if (organizerEmail) {
    void sendEventVendorInquiryOrganizerEmail({
      organizerEmail,
      organizerName: organizer?.display_name ?? "organisator",
      eventTitle: event.title,
      eventSlug: event.slug,
      businessName,
      contactName,
      contactEmail: email,
      message,
    }).catch((err) => {
      console.error("Event vendor inquiry email failed:", err);
    });
  } else {
    console.warn("Event vendor inquiry created but no organizer email to notify", {
      organizerCreatorId: input.organizerCreatorId,
      eventId: input.eventId,
    });
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
