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
import { ensureMerchantSellerLinked } from "@/lib/commerce/medusa/merchant-seller-link";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";

export default async function VerkoperHandoffPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/verkoper");
  }

  const [accessToken, registrationContext, creator] = await Promise.all([
    getAuthAccessToken(),
    getUserRegistrationContext(user.id),
    getCreatorByUserId(user.id),
  ]);

  let caps = resolveDashboardCapabilities({
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

  if (!accessToken) {
    redirect("/login?next=/dashboard/verkoper");
  }

  // Self-heal: merchant role without Medusa merchant seller (common when the
  // user already had a creator seller on the same email).
  if (!caps.canAccessVendorPortal) {
    const displayName =
      creator?.business_name?.trim() ||
      creator?.display_name?.trim() ||
      user.email?.split("@")[0] ||
      "Winkel";

    const linkResult = await ensureMerchantSellerLinked({
      userId: user.id,
      email: user.email ?? creator?.email ?? "",
      displayName,
      contactName: creator?.display_name,
      phone: creator?.phone,
      city: creator?.city,
      countryCode: creator?.country_code ?? "BE",
      supabaseAccessToken: accessToken,
    });

    if (!linkResult.ok) {
      return (
        <CardShell variant="default" padding="lg">
          <h1 className="text-xl font-semibold mb-2">Verkopersportaal</h1>
          <p className="text-sm text-[var(--muted)] mb-4">
            {linkResult.error ??
              "Je merchant-winkel kon niet gekoppeld worden. Probeer het later opnieuw."}
          </p>
          <p className="text-sm">
            <Link href="/dashboard/verkoper" className="text-[var(--accent)] underline">
              Probeer opnieuw
            </Link>
          </p>
        </CardShell>
      );
    }

    const refreshed = await getUserRegistrationContext(user.id);
    caps = resolveDashboardCapabilities({
      registrationContext: refreshed,
      hasCreatorProfile: refreshed.hasCreatorProfile,
    });

    if (!caps.canAccessVendorPortal) {
      return (
        <CardShell variant="default" padding="lg">
          <h1 className="text-xl font-semibold mb-2">Verkopersportaal</h1>
          <p className="text-sm text-[var(--muted)] mb-4">
            Je winkel is aangemaakt, maar de koppeling is nog niet zichtbaar.
            Vernieuw de pagina over enkele seconden.
          </p>
          <p className="text-sm">
            <Link href="/dashboard/verkoper" className="text-[var(--accent)] underline">
              Probeer opnieuw
            </Link>
          </p>
        </CardShell>
      );
    }
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
