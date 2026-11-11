import {
  findArticleHeadings,
  isInstructionsSectionHeading,
} from "./article-section-headings";

export type ArticleBodyHalves = {
  before: string;
  after: string;
};

const MIN_BODY_CHARS = 400;
const MIN_BEFORE_CHARS = 80;

function alreadyShowsImage(markdown: string, imageUrl: string): boolean {
  return markdown.includes(imageUrl);
}

function nearestIndex(candidates: number[], target: number): number | null {
  if (!candidates.length) return null;
  return candidates.reduce((best, value) =>
    Math.abs(value - target) < Math.abs(best - target) ? value : best
  );
}

/** Split long article markdown so the header photo can sit between two halves. */
export function splitArticleBodyForFeaturedImage(
  markdown: string | null | undefined,
  imageUrl: string | null | undefined
): ArticleBodyHalves | null {
  if (!markdown || !imageUrl?.trim()) return null;
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (text.length < MIN_BODY_CHARS || alreadyShowsImage(text, imageUrl.trim())) return null;

  const midpoint = Math.floor(text.length / 2);
  const lower = Math.floor(text.length * 0.28);
  const upper = Math.ceil(text.length * 0.72);
  const headings = findArticleHeadings(text);

  const instructions = headings.find(
    (heading) => heading.start >= MIN_BEFORE_CHARS && isInstructionsSectionHeading(heading.text)
  );
  const headingStarts = headings
    .map((heading) => heading.start)
    .filter((start) => start >= lower && start <= upper && start >= MIN_BEFORE_CHARS);
  const paragraphBreaks = [...text.matchAll(/\n\n+/g)]
    .map((match) => match.index ?? -1)
    .filter((start) => start >= lower && start <= upper && start >= MIN_BEFORE_CHARS);

  const splitAt =
    instructions?.start ??
    nearestIndex(headingStarts, midpoint) ??
    nearestIndex(paragraphBreaks, midpoint);
  if (splitAt == null) return null;

  const before = text.slice(0, splitAt).trimEnd();
  const after = text.slice(splitAt).trimStart();
  if (before.length < MIN_BEFORE_CHARS || after.length < MIN_BEFORE_CHARS) return null;
  return { before, after };
}
