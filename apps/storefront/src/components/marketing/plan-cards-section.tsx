import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { CardShell } from "@/components/ui/card-shell";
import { MarketingSectionHeader } from "./marketing-section-header";

type PlanCard = {
  title: string;
  price: string;
  features: string[];
  featured?: boolean;
};

type PlanCardsSectionProps = {
  id?: string;
  title: string;
  description?: string;
  plans: PlanCard[];
  addons?: string[];
  addonsTitle?: string;
};

function PlanCardsSection({
  id = "pakketten",
  title,
  description,
  plans,
  addons,
  addonsTitle = "Add-ons",
}: PlanCardsSectionProps) {
  return (
    <Section variant="alt" spacing="lg" id={id}>
      <Container>
        <MarketingSectionHeader title={title} description={description} />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <CardShell
              key={plan.title}
              variant={plan.featured ? "featured" : "default"}
              padding="lg"
              className="flex flex-col"
            >
              <h3 className="text-xl font-semibold text-[var(--foreground)] font-[family-name:var(--font-heading)]">
                {plan.title}
              </h3>
              <p className="mt-2 text-2xl font-bold text-[var(--accent)]">
                {plan.price}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="text-sm leading-relaxed text-[var(--muted)] md:text-base"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
            </CardShell>
          ))}
        </div>
        {addons && addons.length > 0 && (
          <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {addonsTitle}
            </h3>
            <ul className="mt-4 flex flex-wrap gap-3">
              {addons.map((addon) => (
                <li
                  key={addon}
                  className="rounded-full border border-[var(--border)] bg-[var(--section-alt)] px-4 py-2 text-sm text-[var(--foreground)]"
                >
                  {addon}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Container>
    </Section>
  );
}

export { PlanCardsSection };
export type { PlanCardsSectionProps, PlanCard };
