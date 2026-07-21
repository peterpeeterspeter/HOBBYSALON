import { redirect } from "next/navigation";
import { AnalyticsFunnelDashboard } from "@/components/analytics/AnalyticsFunnelDashboard";
import { CardShell } from "@/components/ui/card-shell";
import { getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";

export default async function AnalyticsDashboardPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/analytics");
  }

  const [creator, registrationContext] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
  ]);
  const caps = resolveDashboardCapabilities({
    registrationContext,
    creatorTypes: creator?.creator_types,
    hasCreatorProfile: Boolean(creator),
  });
  requireDashboardCapability(caps.canViewAnalytics);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Analytics Dashboard</h1>
      <p className="text-[var(--muted)]">
        Lokale funnel-validatie voor discovery, cart, checkout en purchase events.
      </p>
      <CardShell variant="default" padding="lg">
        <AnalyticsFunnelDashboard />
      </CardShell>
    </section>
  );
}
