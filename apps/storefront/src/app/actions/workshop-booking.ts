"use server";

import { revalidatePath } from "next/cache";
import { createPlatformClient } from "@/lib/platform/client";
import { sendWorkshopBookingCreatorEmail } from "@/lib/platform/notifications/workshop-booking-email";
import { resolveCreatorNotifyEmail } from "@/lib/platform/queries/product-inquiries";

export type WorkshopBookingResult = {
  success: boolean;
  message?: string;
};

export async function submitWorkshopBookingRequest(
  workshopId: string,
  creatorId: string,
  formData: FormData
): Promise<WorkshopBookingResult> {
  const fullName = formData.get("full_name")?.toString()?.trim();
  const email = formData.get("email")?.toString()?.trim();
  const message = formData.get("message")?.toString()?.trim() || null;
  const workshopSessionId =
    (formData.get("workshop_session_id")?.toString() || null) as string | null;

  if (!fullName) {
    return { success: false, message: "Naam is verplicht" };
  }
  if (!email) {
    return { success: false, message: "E-mailadres is verplicht" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Ongeldig e-mailadres" };
  }

  try {
    const supabase = createPlatformClient();

    const { data: workshop, error: workshopError } = await supabase
      .from("workshops")
      .select("id, title, slug, creator_id")
      .eq("id", workshopId)
      .eq("creator_id", creatorId)
      .maybeSingle();

    if (workshopError || !workshop) {
      return { success: false, message: "Workshop niet gevonden." };
    }

    const { error } = await supabase.from("workshop_booking_requests").insert({
      workshop_id: workshopId,
      creator_id: creatorId,
      workshop_session_id: workshopSessionId || null,
      full_name: fullName,
      email,
      message: message || null,
      status: "new",
    });

    if (error) {
      console.error("Workshop booking insert failed:", error);
      return {
        success: false,
        message: "Aanvraag mislukt. Probeer het later opnieuw.",
      };
    }

    const { data: creator } = await supabase
      .from("creators")
      .select("display_name, email, user_id")
      .eq("id", creatorId)
      .maybeSingle();

    const creatorEmail = await resolveCreatorNotifyEmail({
      creatorId,
      userId: creator?.user_id ?? null,
      profileEmail: creator?.email ?? null,
    });

    if (creatorEmail) {
      void sendWorkshopBookingCreatorEmail({
        creatorEmail,
        creatorName: creator?.display_name ?? "workshopgever",
        workshopTitle: workshop.title,
        workshopSlug: workshop.slug,
        inquirerName: fullName,
        inquirerEmail: email,
        message,
      }).catch((err) => {
        console.error("Workshop booking email failed:", err);
      });
    } else {
      console.warn("Workshop booking created but no creator email to notify", {
        creatorId,
        workshopId,
      });
    }

    revalidatePath("/dashboard/workshops");
    return { success: true };
  } catch (e) {
    console.error("Workshop booking error:", e);
    return {
      success: false,
      message: "Er is iets misgegaan. Probeer het later opnieuw.",
    };
  }
}
