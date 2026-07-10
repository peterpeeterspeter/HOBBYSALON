import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";

type HowItWorksSectionProps = {
  title?: string;
  steps: string[];
};

function HowItWorksSection({
  title = "Hoe het werkt",
  steps,
}: HowItWorksSectionProps) {
  return (
    <Section spacing="lg">
      <Container>
        <MarketingSectionHeader title={title} />
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="text-center">
              <span
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-bold text-white"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <p className="mt-4 text-base font-medium leading-relaxed text-[var(--foreground)] md:text-lg">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

export { HowItWorksSection };
export type { HowItWorksSectionProps };
