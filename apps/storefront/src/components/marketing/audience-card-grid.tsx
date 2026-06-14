import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { CardShell } from "@/components/ui/card-shell";
import { MarketingSectionHeader } from "./marketing-section-header";

type AudienceCard = {
  title: string;
  text: string;
  ctaLabel: string;
  href: string;
};

type AudienceCardGridProps = {
  id?: string;
  title?: string;
  description?: string;
  cards: AudienceCard[];
};

function AudienceCardGrid({
  id = "mogelijkheden",
  title = "Kies jouw route",
  description,
  cards,
}: AudienceCardGridProps) {
  return (
    <Section spacing="lg" id={id}>
      <Container>
        <MarketingSectionHeader title={title} description={description} />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="group block">
              <CardShell
                variant="interactive"
                padding="lg"
                className="h-full"
              >
                <h3 className="text-xl font-semibold text-[var(--foreground)] font-[family-name:var(--font-heading)] group-hover:text-[var(--accent)]">
                  {card.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">
                  {card.text}
                </p>
                <span className="mt-6 inline-flex min-h-[48px] items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  {card.ctaLabel}
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </CardShell>
            </Link>
          ))}
        </div>
      </Container>
    </Section>
  );
}

export { AudienceCardGrid };
export type { AudienceCardGridProps, AudienceCard };
