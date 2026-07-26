"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import {
  consumeCredits,
  getCreditBalance,
  LISTING_CREDIT_COSTS,
} from "@/lib/platform/listing-credits";
import { isCommercialGatingEnabled } from "@/lib/platform/commercial-entitlements";
import { sendExhibitorOutreachEmail } from "@/lib/platform/notifications/exhibitor-outreach-email";

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function fail(message: string): never {
  redirect("/dashboard/events?error=" + encodeURIComponent(message));
}

/**
 * Organizer-initiated call to opt-in makers for a specific event ("wie wil
 * standhouder zijn?"). Never shares maker contact info directly - makers
 * who want to respond do so via the existing event_vendor_inquiries flow
 * on the public event page, sharing their own details themselves.
 */
export async function sendExhibitorOutreachAction(formData: FormData): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      redirect("/login?next=/dashboard/events");
    }

    const creator = await getCreatorByUserId(user.id);
    if (!creator) {
      fail("Maak eerst een creator-profiel aan.");
    }

    const eventId = formData.get("event_id")?.toString()?.trim();
    const message = formData.get("message")?.toString()?.trim() || null;
    if (!eventId) {
      fail("Ongeldig event.");
    }

    const supabase = createPlatformClient();
    const { data: event } = await supabase
      .from("events")
      .select("id, title, slug, organizer_creator_id")
      .eq("id", eventId)
      .eq("organizer_creator_id", creator.id)
      .maybeSingle();

    if (!event) {
      fail("Event niet gevonden.");
    }

    const cost = LISTING_CREDIT_COSTS.exhibitorOutreach;
    if (isCommercialGatingEnabled()) {
      const balance = await getCreditBalance(creator.id);
      if (balance < cost) {
        fail(
          `Onvoldoende credits. Een oproep kost ${cost} credits, je hebt er ${balance}.`
        );
      }
    }

    type MakerRow = { id: string; display_name: string; email: string | null };
    const { data: makers } = (await supabase
      .from("creators")
      .select("id, display_name, email")
      .eq("open_to_markets", true)
      .contains("creator_types", ["maker"])
      .neq("id", creator.id)) as { data: MakerRow[] | null };

    const recipients = (makers ?? []).filter(
      (maker): maker is MakerRow & { email: string } => !!maker.email
    );

    if (recipients.length === 0) {
      fail("Geen makers gevonden die openstaan voor markten en beurzen.");
    }

    if (isCommercialGatingEnabled()) {
      const result = await consumeCredits(
        creator.id,
        cost,
        "exhibitor_outreach",
        { type: "event", id: event.id },
        { recipient_count: recipients.length }
      );
      if (!result.ok) {
        fail(result.error ?? "Credits verbruiken mislukt.");
      }
    }

    const emailResults = await Promise.allSettled(
      recipients.map((maker) =>
        sendExhibitorOutreachEmail({
          makerEmail: maker.email,
          makerName: maker.display_name,
          organizerName: creator.display_name,
          eventTitle: event.title,
          eventSlug: event.slug,
          message,
        })
      )
    );
    const sentCount = emailResults.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;

    await supabase.from("event_exhibitor_outreach").insert({
      event_id: event.id,
      organizer_creator_id: creator.id,
      message,
      recipient_count: sentCount,
      credits_spent: isCommercialGatingEnabled() ? cost : 0,
    });

    revalidatePath("/dashboard/events");
    redirect(
      "/dashboard/events?success=" +
        encodeURIComponent(`Oproep verstuurd naar ${sentCount} makers.`)
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Onbekende fout.");
  }
}
