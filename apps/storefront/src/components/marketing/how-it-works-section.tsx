import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { cn } from "@/lib/utils";
import { MarketingSectionHeader } from "./marketing-section-header";

type HowItWorksSectionProps = {
  title?: string;
  steps: string[];
};

/**
 * Asymmetric 1+2 layout when there are three steps (avoids equal 3-col card feel).
 */
function HowItWorksSection({
  title = "Hoe het werkt",
  steps,
}: HowItWorksSectionProps) {
  const asymmetricThree = steps.length === 3;

  return (
    <Section spacing="lg">
      <Container>
        <MarketingSectionHeader title={title} />
        <ol
          className={cn(
            "mt-12 grid gap-8",
            asymmetricThree ? "md:grid-cols-2" : "md:grid-cols-3"
          )}
        >
          {steps.map((step, index) => {
            const isLead = asymmetricThree && index === 0;
            return (
              <li
                key={step}
                className={cn(
                  isLead
                    ? "md:col-span-2 md:flex md:max-w-2xl md:items-center md:gap-6 md:text-left"
                    : "text-center"
                )}
              >
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-bold text-[var(--accent-foreground)]",
                    isLead ? "mx-auto md:mx-0" : "mx-auto"
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <p
                  className={cn(
                    "text-base font-medium leading-relaxed text-[var(--foreground)] md:text-lg",
                    isLead ? "mt-4 md:mt-0" : "mt-4"
                  )}
                >
                  {step}
                </p>
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}

export { HowItWorksSection };
export type { HowItWorksSectionProps };
