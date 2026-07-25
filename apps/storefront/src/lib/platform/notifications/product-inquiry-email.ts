import "server-only";

import { sendNewsletterEmail } from "@/lib/newsletter/resend";

export async function sendProductInquiryCreatorEmail(input: {
  creatorEmail: string;
  creatorName: string;
  productTitle: string;
  productSlug: string;
  inquirerName: string;
  inquirerEmail: string;
  message: string | null;
}): Promise<boolean> {
  const email = input.creatorEmail.trim();
  if (!email) return false;

  const inboxUrl = "https://www.hobbysalon.be/dashboard/products";
  const productUrl = `https://www.hobbysalon.be/product/${encodeURIComponent(input.productSlug)}`;
  const messageHtml = input.message
    ? `<p><strong>Bericht:</strong><br/>${escapeHtml(input.message)}</p>`
    : "";

  return sendNewsletterEmail({
    to: email,
    subject: `Nieuwe aanvraag voor “${input.productTitle}”`,
    html: `
      <p>Hallo ${escapeHtml(input.creatorName)},</p>
      <p>Er is een nieuwe aanvraag binnengekomen voor je plaatsing.</p>
      <ul>
        <li><strong>Plaatsing:</strong> <a href="${productUrl}">${escapeHtml(input.productTitle)}</a></li>
        <li><strong>Naam:</strong> ${escapeHtml(input.inquirerName)}</li>
        <li><strong>E-mail:</strong> ${escapeHtml(input.inquirerEmail)}</li>
      </ul>
      ${messageHtml}
      <p><a href="${inboxUrl}">Open je inbox in het dashboard</a></p>
      <p>Tip: reageer rechtstreeks via e-mail. Hobbysalon verwerkt geen betaling voor makerplaatsingen.</p>
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
