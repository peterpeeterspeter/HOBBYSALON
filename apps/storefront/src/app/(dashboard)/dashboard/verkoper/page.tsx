import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { CardShell } from "@/components/ui/card-shell";
import { getAuthAccessToken, getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { hasPendingRoleRequest } from "@/lib/auth/role-request-status";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import {
  buildVendorPanelHandoffUrl,
  exchangeSupabaseSessionForSellerToken,
} from "@/lib/commerce/medusa/seller-auth-exchange";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";

export default async function VerkoperHandoffPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/verkoper");
  }

  const [accessToken, registrationContext] = await Promise.all([
    getAuthAccessToken(),
    getUserRegistrationContext(user.id),
  ]);

  const caps = resolveDashboardCapabilities({
    registrationContext,
    hasCreatorProfile: registrationContext.hasCreatorProfile,
  });
  requireDashboardCapability(caps.canViewVendorPortalNav);

  const pendingMerchant = hasPendingRoleRequest(
    registrationContext.pendingRoleRequests,
    "merchant"
  );

  if (pendingMerchant && !caps.canAccessVendorPortal) {
    return (
      <CardShell variant="default" padding="lg">
        <h1 className="text-xl font-semibold mb-2">Verkopersportaal</h1>
        <p className="text-sm text-[var(--muted)] mb-4">
          Je merchant-aanvraag wordt beoordeeld. Zodra die is goedgekeurd, open je
          hier je winkel op verkoper.hobbysalon.be.
        </p>
        <p className="text-sm">
          <Link href="/dashboard#account" className="text-[var(--accent)] underline">
            Bekijk je rollen in Account
          </Link>
        </p>
      </CardShell>
    );
  }

  if (!caps.canAccessVendorPortal) {
    return (
      <CardShell variant="default" padding="lg">
        <h1 className="text-xl font-semibold mb-2">Verkopersportaal</h1>
        <p className="text-sm text-[var(--muted)] mb-4">
          Je merchant-rol is actief, maar je winkel is nog niet gekoppeld. Neem contact
          op met Hobbysalon als dit langer duurt dan verwacht.
        </p>
        <p className="text-sm">
          <Link href="/dashboard#account" className="text-[var(--accent)] underline">
            Bekijk je rollen in Account
          </Link>
        </p>
      </CardShell>
    );
  }

  if (!accessToken) {
    redirect("/login?next=/dashboard/verkoper");
  }

  try {
    const exchange = await exchangeSupabaseSessionForSellerToken(accessToken);
    redirect(buildVendorPanelHandoffUrl(exchange.token));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Kon het verkopersportaal niet openen.";

    return (
      <CardShell variant="default" padding="lg">
        <h1 className="text-xl font-semibold mb-2">Verkopersportaal</h1>
        <p className="text-sm text-[var(--muted)] mb-4">{message}</p>
        <p className="text-sm">
          Beheer verzending, voorraad en uitbetalingen in het verkopersportaal.{" "}
          <Link href="/dashboard/verkoper" className="text-[var(--accent)] underline">
            Probeer opnieuw
          </Link>
        </p>
      </CardShell>
    );
  }
}
