import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";

type CommercialModelBlockProps = {
  id?: string;
  title: string;
  text: string;
};

function CommercialModelBlock({ id, title, text }: CommercialModelBlockProps) {
  return (
    <Section spacing="md" id={id}>
      <Container>
        <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--section-highlight)] p-8 md:p-10">
          <h2 className="text-2xl font-bold text-[var(--foreground)] font-[family-name:var(--font-heading)] md:text-3xl">
            {title}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--muted)] md:text-lg">
            {text}
          </p>
        </div>
      </Container>
    </Section>
  );
}

export { CommercialModelBlock };
export type { CommercialModelBlockProps };
