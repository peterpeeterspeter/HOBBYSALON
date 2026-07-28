import "server-only";

import { sendNewsletterEmail } from "@/lib/newsletter/resend";

export async function sendWorkshopBookingCreatorEmail(input: {
  creatorEmail: string;
  creatorName: string;
  workshopTitle: string;
  workshopSlug: string;
  inquirerName: string;
  inquirerEmail: string;
  message: string | null;
}): Promise<boolean> {
  const email = input.creatorEmail.trim();
  if (!email) return false;

  const inboxUrl = "https://www.hobbysalon.be/dashboard/workshops";
  const workshopUrl = `https://www.hobbysalon.be/workshop/${encodeURIComponent(input.workshopSlug)}`;
  const messageHtml = input.message
    ? `<p><strong>Bericht:</strong><br/>${escapeHtml(input.message)}</p>`
    : "";

  return sendNewsletterEmail({
    to: email,
    subject: `Nieuwe boekingsaanvraag voor “${input.workshopTitle}”`,
    html: `
      <p>Hallo ${escapeHtml(input.creatorName)},</p>
      <p>Er is een nieuwe boekingsaanvraag binnengekomen voor je workshop.</p>
      <ul>
        <li><strong>Workshop:</strong> <a href="${workshopUrl}">${escapeHtml(input.workshopTitle)}</a></li>
        <li><strong>Naam:</strong> ${escapeHtml(input.inquirerName)}</li>
        <li><strong>E-mail:</strong> ${escapeHtml(input.inquirerEmail)}</li>
      </ul>
      ${messageHtml}
      <p><a href="${inboxUrl}">Open je boekingsaanvragen in het dashboard</a></p>
      <p>Tip: reageer rechtstreeks via e-mail om de inschrijving verder te regelen.</p>
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
