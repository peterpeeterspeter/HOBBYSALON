import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";
import { FaqSection } from "./faq-section";
import {
  PRIJZEN_PAGE,
  PRICING_HOWTO_BLOCKS,
  PRICING_PAGE_FAQ,
} from "@/lib/pricing/public-pricing";

function PricingExplainerSections() {
  return (
    <>
      <Section spacing="md">
        <Container>
          <MarketingSectionHeader title={PRIJZEN_PAGE.howtoTitle} />
          <div className="mt-8 max-w-3xl space-y-8">
            {PRICING_HOWTO_BLOCKS.map((block) => (
              <div key={block.title}>
                <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
                  {block.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {block.text}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>
      <FaqSection title={PRIJZEN_PAGE.faqTitle} items={PRICING_PAGE_FAQ} />
    </>
  );
}

type PricingClosingLinksProps = {
  title: string;
  description: string;
  links: ReadonlyArray<{ label: string; href: string }>;
};

function PricingClosingLinks({
  title,
  description,
  links,
}: PricingClosingLinksProps) {
  return (
    <Section spacing="lg" variant="highlight">
      <Container>
        <div className="max-w-3xl">
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)] md:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[var(--muted)]">
            {description}
          </p>
          <ul className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-12 items-center text-base font-semibold text-[var(--accent)] hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}

export { PricingExplainerSections, PricingClosingLinks };
export type { PricingClosingLinksProps };
