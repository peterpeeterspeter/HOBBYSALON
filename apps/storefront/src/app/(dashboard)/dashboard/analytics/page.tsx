import { AnalyticsFunnelDashboard } from "@/components/analytics/AnalyticsFunnelDashboard";

export default function AnalyticsDashboardPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Analytics Dashboard</h1>
      <p className="text-[var(--muted)]">
        Lokale funnel-validatie voor discovery, cart, checkout en purchase events.
      </p>
      <AnalyticsFunnelDashboard />
    </section>
  );
}
