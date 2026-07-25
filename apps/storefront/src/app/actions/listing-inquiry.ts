"use server";

import { createPlatformClient } from "@/lib/platform/client";

export type ListingInquiryResult = {
  success: boolean;
  message?: string;
};

const ENTITY_TYPES = new Set(["product", "event", "creator"]);

export async function submitListingInquiry(
  entityType: "product" | "event" | "creator",
  entityId: string,
  creatorId: string,
  formData: FormData
): Promise<ListingInquiryResult> {
  const fullName = formData.get("full_name")?.toString()?.trim();
  const email = formData.get("email")?.toString()?.trim();
  const phone = formData.get("phone")?.toString()?.trim() || null;
  const message = formData.get("message")?.toString()?.trim() || null;

  if (!ENTITY_TYPES.has(entityType)) {
    return { success: false, message: "Ongeldig aanvraagtype." };
  }
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
    const { error } = await supabase.from("listing_inquiries").insert({
      entity_type: entityType,
      entity_id: entityId,
      creator_id: creatorId,
      full_name: fullName,
      email,
      phone,
      message,
      status: "new",
    });

    if (error) {
      console.error("Listing inquiry insert failed:", error);
      return { success: false, message: "Aanvraag mislukt. Probeer het later opnieuw." };
    }

    return { success: true };
  } catch (e) {
    console.error("Listing inquiry error:", e);
    return { success: false, message: "Er is iets misgegaan. Probeer het later opnieuw." };
  }
}
