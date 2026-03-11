"use server";

import { createPlatformClient } from "@/lib/platform/client";

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
      return { success: false, message: "Aanvraag mislukt. Probeer het later opnieuw." };
    }

    return { success: true };
  } catch (e) {
    console.error("Workshop booking error:", e);
    return { success: false, message: "Er is iets misgegaan. Probeer het later opnieuw." };
  }
}
