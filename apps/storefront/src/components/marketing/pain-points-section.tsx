import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";

type PainPointsSectionProps = {
  title?: string;
  items: string[];
};

function PainPointsSection({
  title = "Herken je dit?",
  items,
}: PainPointsSectionProps) {
  return (
    <Section variant="alt" spacing="lg">
      <Container>
        <MarketingSectionHeader title={title} />
        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-[var(--foreground)] shadow-[var(--shadow-sm)]"
            >
              <p className="text-base leading-relaxed md:text-lg">{item}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export { PainPointsSection };
export type { PainPointsSectionProps };
