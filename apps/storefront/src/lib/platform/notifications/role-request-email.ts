import "server-only";

import type { PrivilegedRole, RoleRequestPayload } from "@/lib/platform/queries/role-requests";
import { ACCOUNT_ROLE_LABELS } from "@/lib/auth/account-roles";
import { sendNewsletterEmail } from "@/lib/newsletter/resend";

const ROLE_LABELS: Record<PrivilegedRole, string> = {
  merchant: ACCOUNT_ROLE_LABELS.merchant,
  workshop_host: ACCOUNT_ROLE_LABELS.workshop_host,
  organizer: ACCOUNT_ROLE_LABELS.organizer,
};

export async function sendRoleRequestAdminEmail(input: {
  role: PrivilegedRole;
  userId: string;
  payload: RoleRequestPayload;
}): Promise<boolean> {
  const adminEmail =
    process.env.ROLE_REQUEST_ADMIN_EMAIL?.trim() ??
    process.env.RESEND_ADMIN_EMAIL?.trim();

  if (!adminEmail) {
    return false;
  }

  const roleLabel = ROLE_LABELS[input.role];
  const displayName = input.payload.displayName?.trim() || "Onbekend";
  const userEmail = input.payload.email?.trim() || "—";
  const dashboardUrl = "https://www.hobbysalon.be/dashboard/moderatie/roles";

  return sendNewsletterEmail({
    to: adminEmail,
    subject: `Nieuwe rolaanvraag: ${roleLabel}`,
    html: `
      <p>Er is een nieuwe rolaanvraag binnen.</p>
      <ul>
        <li><strong>Rol:</strong> ${roleLabel}</li>
        <li><strong>Naam:</strong> ${displayName}</li>
        <li><strong>E-mail:</strong> ${userEmail}</li>
        <li><strong>User ID:</strong> ${input.userId}</li>
      </ul>
      <p><a href="${dashboardUrl}">Open moderatie-wachtrij</a></p>
    `,
  });
}
