import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";

type TrustBulletsProps = {
  title?: string;
  items: string[];
};

function TrustBullets({
  title = "Vertrouwd platform",
  items,
}: TrustBulletsProps) {
  return (
    <Section variant="highlight" spacing="lg">
      <Container>
        <MarketingSectionHeader title={title} />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-base leading-relaxed text-[var(--foreground)]"
            >
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export { TrustBullets };
export type { TrustBulletsProps };
