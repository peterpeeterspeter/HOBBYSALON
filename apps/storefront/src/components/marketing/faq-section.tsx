import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqSectionProps = {
  title?: string;
  items: FaqItem[];
};

function FaqSection({ title = "Veelgestelde vragen", items }: FaqSectionProps) {
  return (
    <Section variant="alt" spacing="lg">
      <Container size="narrow">
        <MarketingSectionHeader title={title} />
        <div className="mt-10 space-y-4">
          {items.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border border-[var(--border)] bg-[var(--card)]"
            >
              <summary className="cursor-pointer list-none px-6 py-5 text-base font-semibold text-[var(--foreground)] md:text-lg [&::-webkit-details-marker]:hidden">
                <span className="flex min-h-[48px] items-center justify-between gap-4">
                  {item.question}
                  <span
                    className="shrink-0 text-[var(--accent)] transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </span>
              </summary>
              <div className="border-t border-[var(--border)] px-6 py-5 text-base leading-relaxed text-[var(--muted)]">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}

export { FaqSection };
export type { FaqSectionProps, FaqItem };
