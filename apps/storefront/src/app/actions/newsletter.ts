"use server";

import { createPlatformClient } from "@/lib/platform/client";

export type NewsletterActionState = {
  success: boolean;
  message: string;
};

const ALLOWED_INTEREST_TYPES = new Set([
  "workshop",
  "supply",
  "handmade",
  "event",
  "article",
]);

export async function subscribeNewsletterAction(
  _prevState: NewsletterActionState,
  formData: FormData
): Promise<NewsletterActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const firstName = formData.get("first_name")?.toString().trim() || null;
  const preferredCity = formData.get("preferred_city")?.toString().trim() || null;
  const interestType =
    formData.get("interest_type")?.toString().trim().toLowerCase() || null;
  const domainId = formData.get("domain_id")?.toString().trim() || null;

  if (!email) {
    return { success: false, message: "E-mailadres is verplicht." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Voer een geldig e-mailadres in." };
  }

  const supabase = createPlatformClient();
  const { data: subscriber, error: upsertError } = await supabase
    .from("subscribers")
    .upsert(
      {
        email,
        first_name: firstName,
        preferred_city: preferredCity,
        source: "site_form",
        status: "active",
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();

  if (upsertError || !subscriber) {
    return {
      success: false,
      message: "Inschrijven mislukt. Probeer later opnieuw.",
    };
  }

  if (interestType && ALLOWED_INTEREST_TYPES.has(interestType)) {
    await supabase.from("survey_segments").insert({
      subscriber_id: subscriber.id,
      domain_id: domainId || null,
      interest_type: interestType,
      score: 1,
    });
  }

  return {
    success: true,
    message: "Ingeschreven! Je ontvangt binnenkort inspiratie in je inbox.",
  };
}
