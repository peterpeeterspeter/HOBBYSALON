import type { CalcFaq } from "@/lib/tools/engine";
import type { JsonLdObject } from "@/lib/schema";

/** Build FAQPage JSON-LD from calculator definition FAQs. */
export function buildToolFaqSchema(faqs: CalcFaq[] | undefined): JsonLdObject | null {
  if (!faqs || faqs.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
