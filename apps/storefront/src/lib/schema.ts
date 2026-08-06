/**
 * Schema.org structured-data generators for Google rich results.
 *
 * Extracts FAQ, HowTo, and Breadcrumb data from article body_markdown
 * to produce JSON-LD that powers rich snippets in search results.
 */

import { absoluteUrl } from "@/lib/seo";
import { parseArticleSteps } from "@/lib/content/parse-article-steps";

export type JsonLdObject = Record<string, unknown>;

/**
 * Build a BreadcrumbList schema from a trail of {name, path} segments.
 */
export function buildBreadcrumbSchema(
  trail: { name: string; path: string }[]
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * Parse FAQ Q&A pairs from article body_markdown.
 *
 * The Hobbysalon article format has a section like:
 *
 *   ❓ VEELGESTELDE VRAGEN
 *
 *   Question one?
 *   Answer paragraph...
 *
 *   Question two?
 *   Answer paragraph...
 *
 * Questions are detected as short lines ending with "?".
 * Answers are the paragraphs that follow until the next question
 * or the next section header (emoji+UPPERCASE or ⚖️/🎯/🚀).
 *
 * Returns null if fewer than 2 Q&A pairs are found (Google requires ≥2).
 */
export function buildFaqSchema(bodyMarkdown: string): JsonLdObject | null {
  const faqMatch = bodyMarkdown.match(
    /VEELGESTELDE\s+VRAGEN/i
  );
  if (!faqMatch) return null;

  // Get everything after the FAQ header until the next major section
  const afterFaq = bodyMarkdown.slice(faqMatch.index! + faqMatch[0].length);

  // Stop at the next section header (emoji + UPPERCASE, or ⚖/🎯/🚀/✅/🔍)
  const nextSectionMatch = afterFaq.match(
    /\n\s*(?:⚖|🎯|🚀|✅|🔍|📊|🎉|💪|⭐|🏁|👋|💬|❓)\s*[A-Z]/
  );
  const faqSection = nextSectionMatch
    ? afterFaq.slice(0, nextSectionMatch.index)
    : afterFaq;

  // Split into paragraphs
  const paragraphs = faqSection
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const faqs: { question: string; answer: string }[] = [];
  let i = 0;
  while (i < paragraphs.length) {
    const para = paragraphs[i];
    // A question is a short paragraph ending with "?"
    // It should not start with a list marker or be a section header
    const isQuestion =
      para.endsWith("?") &&
      para.length < 200 &&
      !para.startsWith("-") &&
      !para.startsWith("Stap") &&
      !para.match(/^[🌟🌸📈🛒📋💡🎨⭐❓⚖🎯🚀✅🔍📊🎉💪]/);

    if (isQuestion) {
      const question = para;
      // Collect answer from following paragraphs until next question or end
      const answerParts: string[] = [];
      let j = i + 1;
      while (j < paragraphs.length) {
        const next = paragraphs[j];
        if (
          next.endsWith("?") &&
          next.length < 200 &&
          !next.startsWith("-")
        ) {
          break; // Next question
        }
        // Stop at section headers
        if (next.match(/^[🌟🌸📈🛒📋💡🎨⭐❓⚖🎯🚀✅🔍📊🎉💪]/)) break;
        answerParts.push(next);
        j++;
        if (answerParts.length >= 3) break; // Cap answer length
      }
      const answer = answerParts.join(" ").trim();
      if (answer.length > 10) {
        faqs.push({ question, answer });
      }
      i = j;
    } else {
      i++;
    }
  }

  if (faqs.length < 2) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}

/**
 * Parse HowTo steps from article body_markdown via parseArticleSteps.
 *
 * The Hobbysalon article format has a section like:
 *
 *   📋 STAP VOOR STAP
 *
 *   Stap 1: Het papier voorbereiden
 *   Detailed instructions...
 *
 * Returns null if fewer than 3 steps are found.
 */
export function buildHowToSchema(
  bodyMarkdown: string,
  articleTitle: string,
  articleImage?: string | null
): JsonLdObject | null {
  const parsed = parseArticleSteps(bodyMarkdown);
  if (parsed.length < 3) return null;

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: articleTitle,
    ...(articleImage ? { image: absoluteUrl(articleImage) } : {}),
    step: parsed.map((s, i) => {
      const shortName = s.title.replace(/^Stap\s+\d+\s*:\s*/i, "").trim();
      return {
        "@type": "HowToStep",
        position: i + 1,
        name: shortName || s.title,
        text: s.detail ?? s.title,
      };
    }),
  };
}
