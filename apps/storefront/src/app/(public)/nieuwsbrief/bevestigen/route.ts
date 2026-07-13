import { NextRequest, NextResponse } from "next/server";
import { createPlatformClient } from "@/lib/platform/client";
import { verifyConfirmationToken } from "@/lib/newsletter/lead-magnet";
import { isNewsletterEmailConfigured, sendNewsletterEmail } from "@/lib/newsletter/resend";
import { syncConfirmedAcumbamailSubscriber } from "@/lib/newsletter/acumbamail";

function confirmationResponse(request: NextRequest, message: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Nieuwsbrief</title></head><body><main><h1>${message}</h1><p><a href="${request.nextUrl.origin}">Terug naar Hobbysalon</a></p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  const secret = process.env.NEWSLETTER_CONFIRMATION_SECRET?.trim();
  const token = request.nextUrl.searchParams.get("token");
  const payload = secret && token ? verifyConfirmationToken(token, secret) : null;

  if (!payload) return confirmationResponse(request, "Deze bevestigingslink is ongeldig.", 400);
  if (!isNewsletterEmailConfigured()) {
    return confirmationResponse(request, "De download is tijdelijk niet beschikbaar. Probeer later opnieuw.", 503);
  }

  const supabase = createPlatformClient();
  const { data: leadMagnet, error: leadMagnetError } = await supabase
    .from("newsletter_lead_magnets")
    .select("id, title, file_url")
    .eq("code", payload.leadMagnetCode)
    .eq("is_active", true)
    .maybeSingle();
  if (leadMagnetError || !leadMagnet) {
    return confirmationResponse(request, "Deze download is niet beschikbaar.", 404);
  }

  const { data: event, error: eventError } = await supabase
    .from("newsletter_opt_in_events")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("email", payload.email)
    .eq("lead_magnet_id", leadMagnet.id)
    .eq("status", "pending")
    .select("id, source_path, confirmed_at")
    .maybeSingle();
  if (eventError) return confirmationResponse(request, "Bevestigen mislukt. Probeer later opnieuw.", 500);
  if (!event) return confirmationResponse(request, "Deze inschrijving is al bevestigd of bestaat niet.");

  await syncConfirmedAcumbamailSubscriber({
    email: payload.email,
    firstName: null,
    preferredCity: null,
    sourcePath: event.source_path,
    confirmedAt: event.confirmed_at ?? new Date().toISOString(),
  });

  const deliveryUrl = leadMagnet.file_url.replace("{{token}}", encodeURIComponent(token!));
  const sent = await sendNewsletterEmail({
    to: payload.email,
    subject: `Je download: ${leadMagnet.title}`,
    html: `<p>Bedankt voor je bevestiging.</p><p><a href="${deliveryUrl}">Download ${leadMagnet.title}</a></p>`,
  });
  return sent
    ? confirmationResponse(request, "Bedankt! Je downloadlink is naar je inbox gestuurd.")
    : confirmationResponse(request, "Je inschrijving is bevestigd, maar de downloadmail kon niet worden verstuurd. Probeer later opnieuw.", 502);
}
