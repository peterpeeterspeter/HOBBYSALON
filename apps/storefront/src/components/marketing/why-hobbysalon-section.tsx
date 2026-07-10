import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";

type WhyHobbysalonSectionProps = {
  title?: string;
  items: string[];
};

function WhyHobbysalonSection({
  title = "Waarom Hobbysalon",
  items,
}: WhyHobbysalonSectionProps) {
  return (
    <Section variant="highlight" spacing="lg">
      <Container>
        <MarketingSectionHeader title={title} />
        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-base leading-relaxed text-[var(--foreground)] md:text-lg"
            >
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export { WhyHobbysalonSection };
export type { WhyHobbysalonSectionProps };
