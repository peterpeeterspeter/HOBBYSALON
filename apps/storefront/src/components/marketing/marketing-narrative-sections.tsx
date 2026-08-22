import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import type { DetailPageCopy } from "@/lib/pricing/public-pricing";

type MarketingNarrativeSectionsProps = {
  sections: DetailPageCopy["sections"];
};

function MarketingNarrativeSections({
  sections,
}: MarketingNarrativeSectionsProps) {
  return (
    <>
      {sections.map((section, index) => (
        <Section
          key={section.title}
          spacing="md"
          variant={index % 2 === 1 ? "alt" : "default"}
        >
          <Container>
            <div className="max-w-3xl">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                {section.title}
              </h2>
              {section.listIntro ? (
                <p className="mt-4 text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {section.listIntro}
                </p>
              ) : null}
              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-4 text-base leading-relaxed text-[var(--muted)] md:text-lg"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-5 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="text-base leading-relaxed text-[var(--foreground)] md:text-lg"
                    >
                      · {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Container>
        </Section>
      ))}
    </>
  );
}

export { MarketingNarrativeSections };
export type { MarketingNarrativeSectionsProps };
