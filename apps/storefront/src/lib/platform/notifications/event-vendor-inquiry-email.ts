import "server-only";

import { sendNewsletterEmail } from "@/lib/newsletter/resend";

export async function sendEventVendorInquiryOrganizerEmail(input: {
  organizerEmail: string;
  organizerName: string;
  eventTitle: string;
  eventSlug: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  message: string | null;
}): Promise<boolean> {
  const email = input.organizerEmail.trim();
  if (!email) return false;

  const inboxUrl = "https://www.hobbysalon.be/dashboard/events";
  const eventUrl = `https://www.hobbysalon.be/agenda/${encodeURIComponent(input.eventSlug)}`;
  const messageHtml = input.message
    ? `<p><strong>Bericht:</strong><br/>${escapeHtml(input.message)}</p>`
    : "";

  return sendNewsletterEmail({
    to: email,
    subject: `Nieuwe standhouder-aanvraag voor “${input.eventTitle}”`,
    html: `
      <p>Hallo ${escapeHtml(input.organizerName)},</p>
      <p>Er is een nieuwe standhouder-aanvraag binnengekomen voor je event.</p>
      <ul>
        <li><strong>Event:</strong> <a href="${eventUrl}">${escapeHtml(input.eventTitle)}</a></li>
        <li><strong>Bedrijf:</strong> ${escapeHtml(input.businessName)}</li>
        <li><strong>Contactpersoon:</strong> ${escapeHtml(input.contactName)}</li>
        <li><strong>E-mail:</strong> ${escapeHtml(input.contactEmail)}</li>
      </ul>
      ${messageHtml}
      <p><a href="${inboxUrl}">Open je standhouder-aanvragen in het dashboard</a></p>
      <p>Tip: reageer rechtstreeks via e-mail om de deelname verder te bespreken.</p>
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
