import "server-only";

import { sendNewsletterEmail } from "@/lib/newsletter/resend";

export async function sendExhibitorOutreachEmail(input: {
  makerEmail: string;
  makerName: string;
  organizerName: string;
  eventTitle: string;
  eventSlug: string;
  message: string | null;
}): Promise<boolean> {
  const email = input.makerEmail.trim();
  if (!email) return false;

  const eventUrl = `https://www.hobbysalon.be/agenda/${encodeURIComponent(
    input.eventSlug
  )}#standhouders`;
  const messageHtml = input.message
    ? `<p><strong>Bericht van ${escapeHtml(input.organizerName)}:</strong><br/>${escapeHtml(
        input.message
      )}</p>`
    : "";

  return sendNewsletterEmail({
    to: email,
    subject: `Standplaats gezocht voor "${input.eventTitle}"`,
    html: `
      <p>Hallo ${escapeHtml(input.makerName)},</p>
      <p>${escapeHtml(
        input.organizerName
      )} organiseert <strong>${escapeHtml(
      input.eventTitle
    )}</strong> en zoekt standhouders. Je krijgt dit bericht omdat je op je makerprofiel hebt aangegeven open te staan voor markten en beurzen.</p>
      ${messageHtml}
      <p><a href="${eventUrl}">Bekijk het event en meld je aan als standhouder</a></p>
      <p style="font-size: 13px; color: #666;">Wil je geen oproepen meer ontvangen? Zet "Ik sta open voor markten en beurzen" uit op je makerprofiel.</p>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
