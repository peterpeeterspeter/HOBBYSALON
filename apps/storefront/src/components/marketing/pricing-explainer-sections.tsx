import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";
import { CREDITS_EXPLANATION, WHY_DIFFERENT_FORMULAS } from "@/lib/pricing/public-pricing";

function PricingExplainerSections() {
  return (
    <>
      <Section spacing="md">
        <Container>
          <div className="max-w-3xl">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
              {WHY_DIFFERENT_FORMULAS.title}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[var(--muted)]">
              {WHY_DIFFERENT_FORMULAS.text}
            </p>
          </div>
        </Container>
      </Section>
      <Section spacing="md" variant="alt">
        <Container>
          <MarketingSectionHeader
            title={CREDITS_EXPLANATION.title}
            description={CREDITS_EXPLANATION.paragraphs[0]}
          />
          <div className="mt-6 max-w-3xl space-y-4">
            {CREDITS_EXPLANATION.paragraphs.slice(1).map((paragraph) => (
              <p key={paragraph} className="text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {paragraph}
              </p>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}

export { PricingExplainerSections };
