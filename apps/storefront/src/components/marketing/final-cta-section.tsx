import { CTABanner } from "@/components/home/cta-banner";

type FinalCtaSectionProps = {
  title: string;
  description: string;
  href: string;
  ctaText: string;
  secondaryHref?: string;
  secondaryText?: string;
};

function FinalCtaSection({
  title,
  description,
  href,
  ctaText,
  secondaryHref,
  secondaryText,
}: FinalCtaSectionProps) {
  return (
    <CTABanner
      variant="dark"
      title={title}
      description={description}
      href={href}
      ctaText={ctaText}
      secondaryHref={secondaryHref}
      secondaryText={secondaryText}
    />
  );
}

export { FinalCtaSection };
export type { FinalCtaSectionProps };
