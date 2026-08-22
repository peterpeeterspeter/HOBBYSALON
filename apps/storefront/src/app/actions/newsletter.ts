"use server";

import { createPlatformClient } from "@/lib/platform/client";
import { syncConfirmedAcumbamailSubscriber } from "@/lib/newsletter/acumbamail";
import {
  buildConfirmationUrl,
  createConfirmationToken,
  getNewsletterSiteUrl,
  normalizeNewsletterEmail,
} from "@/lib/newsletter/lead-magnet";
import {
  isNewsletterEmailConfigured,
  sendNewsletterEmail,
} from "@/lib/newsletter/resend";

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

function confirmationEmail(url: string, title: string): string {
  return `<p>Bevestig je inschrijving voor ${title}.</p><p><a href="${url}">Ja, stuur mij de download</a></p><p>Heb je dit niet aangevraagd? Dan hoef je niets te doen.</p>`;
}

async function subscribeToLeadMagnet(
  email: string,
  leadMagnetCode: string,
  sourcePath: string
): Promise<NewsletterActionState> {
  const confirmationSecret = process.env.NEWSLETTER_CONFIRMATION_SECRET?.trim();
  const siteUrl = getNewsletterSiteUrl();
  if (!confirmationSecret || !siteUrl || !isNewsletterEmailConfigured()) {
    return {
      success: false,
      message: "De downloadinschrijving is tijdelijk niet beschikbaar. Probeer later opnieuw.",
    };
  }

  const supabase = createPlatformClient();
  const { data: leadMagnet, error: leadMagnetError } = await supabase
    .from("newsletter_lead_magnets")
    .select("id, title")
    .eq("code", leadMagnetCode)
    .eq("is_active", true)
    .maybeSingle();

  if (leadMagnetError || !leadMagnet) {
    return { success: false, message: "Deze download is niet beschikbaar." };
  }

  const { error: optInError } = await supabase
    .from("newsletter_opt_in_events")
    .upsert(
      {
        email,
        lead_magnet_id: leadMagnet.id,
        source_path: sourcePath,
        status: "pending",
        consented_at: new Date().toISOString(),
        confirmed_at: null,
      },
      { onConflict: "email,lead_magnet_id" }
    );

  if (optInError) {
    return { success: false, message: "Inschrijven mislukt. Probeer later opnieuw." };
  }

  const token = createConfirmationToken({ email, leadMagnetCode }, confirmationSecret);
  const sent = await sendNewsletterEmail({
    to: email,
    subject: `Bevestig je download: ${leadMagnet.title}`,
    html: confirmationEmail(buildConfirmationUrl(siteUrl, token), leadMagnet.title),
  });

  return sent
    ? { success: true, message: "Controleer je inbox en bevestig je e-mailadres voor de download." }
    : { success: false, message: "De bevestigingsmail kon niet worden verstuurd. Probeer later opnieuw." };
}

export async function subscribeNewsletterAction(
  _prevState: NewsletterActionState,
  formData: FormData
): Promise<NewsletterActionState> {
  const email = normalizeNewsletterEmail(formData.get("email")?.toString() ?? "");
  const firstName = formData.get("first_name")?.toString().trim() || null;
  const preferredCity = formData.get("preferred_city")?.toString().trim() || null;
  const interestType = formData.get("interest_type")?.toString().trim().toLowerCase() || null;
  const domainId = formData.get("domain_id")?.toString().trim() || null;
  const leadMagnetCode = formData.get("lead_magnet_code")?.toString().trim() || null;
  const sourcePath = formData.get("source_path")?.toString().trim() || "site_form";

  if (!email) {
    return { success: false, message: "Voer een geldig e-mailadres in." };
  }

  if (leadMagnetCode) return subscribeToLeadMagnet(email, leadMagnetCode, sourcePath);

  const supabase = createPlatformClient();
  const confirmedAt = new Date().toISOString();
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
    return { success: false, message: "Inschrijven mislukt. Probeer later opnieuw." };
  }

  if (interestType && ALLOWED_INTEREST_TYPES.has(interestType)) {
    await supabase.from("survey_segments").insert({
      subscriber_id: subscriber.id,
      domain_id: domainId,
      interest_type: interestType,
      score: 1,
    });
  }

  const sync = await syncConfirmedAcumbamailSubscriber({
    email,
    firstName,
    preferredCity,
    sourcePath,
    confirmedAt,
  });

  if (sync.ok) {
    await supabase
      .from("subscribers")
      .update({ acumbamail_synced_at: confirmedAt, updated_at: confirmedAt })
      .eq("id", subscriber.id);
  }

  return { success: true, message: "Ingeschreven! Je ontvangt binnenkort inspiratie in je inbox." };
}
