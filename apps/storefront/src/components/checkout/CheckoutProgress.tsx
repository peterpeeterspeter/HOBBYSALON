import type { CheckoutStep } from "@/lib/commerce/checkout-progress";

const STEPS: Array<{ id: CheckoutStep; label: string }> = [
  { id: "address", label: "Gegevens" },
  { id: "shipping", label: "Verzending" },
  { id: "payment", label: "Betalen" },
];

export function CheckoutProgress({ current }: { current: CheckoutStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);
  return (
    <nav aria-label="Voortgang afrekenen" className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((step, index) => {
          const active = index === currentIndex;
          const complete = index < currentIndex;
          return <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${active || complete ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--surface)] text-[var(--muted)]"}`}>{complete ? "✓" : index + 1}</span><span className={`hidden text-sm font-semibold sm:inline ${active ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{step.label}</span>{index < STEPS.length - 1 && <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />}</li>;
        })}
      </ol>
    </nav>
  );
}
