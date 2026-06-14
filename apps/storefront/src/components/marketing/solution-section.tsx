import { Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";

type SolutionSectionProps = {
  title?: string;
  description?: string;
  items: string[];
};

function SolutionSection({
  title = "Wat Hobbysalon voor jou doet",
  description,
  items,
}: SolutionSectionProps) {
  return (
    <Section spacing="lg">
      <Container>
        <MarketingSectionHeader title={title} description={description} />
        <ul className="mt-12 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]"
                aria-hidden="true"
              >
                <Check size={14} />
              </span>
              <span className="text-base leading-relaxed text-[var(--foreground)] md:text-lg">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export { SolutionSection };
export type { SolutionSectionProps };
