/**
 * Heading-driven instructions extraction from article body_markdown.
 *
 * Strategies (first match wins content):
 * 1. Dedicated instructions section (Stap voor stap, Instructies, …)
 * 2. Else: body after materials section through Bron/Tips/…
 * 3. Else: whole article
 *
 * Within a region:
 * - "Stap N:" / "Toer N:" / "Ronde N:" blocks with following prose
 * - Else markdown list bullets
 * - Else each instructional subsection heading becomes a step
 */

import {
  findArticleHeadings,
  isInstructionsSectionHeading,
  isMaterialsSectionHeading,
  isStopSectionHeading,
  type ArticleHeadingHit,
} from "./article-section-headings";

export type ParsedArticleStep = {
  key: string;
  title: string;
  detail: string | null;
};

const LIST_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/;
/** Stap 1: … | Toer 3: … | Toer 6 tot en met 8: … | Ronde 2: … | Step 1: … */
const NUMBERED_STEP_LINE_RE =
  /^(?:Stap|Toer|Ronde|Step|Round)\s+(\d+)(?:\s+tot(?:\s+en\s+met)?\s+\d+)?\s*:\s*(.+)$/i;
const MAX_DETAIL_CHARS = 500;
const MAX_STEPS = 40;

function stripMarkdownInline(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "$1")
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateDetail(raw: string): string | null {
  const cleaned = raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return null;
  if (cleaned.length <= MAX_DETAIL_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_DETAIL_CHARS).trimEnd()}…`;
}

function extractDedicatedInstructionsSection(
  bodyMarkdown: string,
  headings: ArticleHeadingHit[]
): string | null {
  const heading = headings.find((h) => isInstructionsSectionHeading(h.text));
  if (!heading) return null;

  const nextBoundary = headings.find(
    (h) => h.start > heading.start && h.level <= heading.level
  );
  const end = nextBoundary ? nextBoundary.start : bodyMarkdown.length;
  return bodyMarkdown.slice(heading.end, end);
}

/**
 * Region after materials (or start) until a hard stop heading (Bron, Tips, …).
 */
function extractInstructionsFallbackRegion(
  bodyMarkdown: string,
  headings: ArticleHeadingHit[]
): string {
  const materials = headings.find((h) => isMaterialsSectionHeading(h.text));
  let start = 0;
  if (materials) {
    const afterMaterials = headings.find(
      (h) => h.start > materials.start && h.level <= materials.level
    );
    // No further sections → nothing to treat as instructions
    if (!afterMaterials) return "";
    start = afterMaterials.start;
  }

  const stop = headings.find(
    (h) => h.start > start && isStopSectionHeading(h.text)
  );
  const end = stop ? stop.start : bodyMarkdown.length;
  return bodyMarkdown.slice(start, end);
}

function parseNumberedBlocks(section: string): ParsedArticleStep[] {
  const lines = section.split(/\n/);
  const headers: {
    label: string;
    titlePart: string;
    bodyStartLine: number;
  }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().replace(/^[-*+]\s+/, "");
    const match = trimmed.match(NUMBERED_STEP_LINE_RE);
    if (!match) continue;
    const titlePart = stripMarkdownInline(match[2]);
    if (!titlePart) continue;
    const kindMatch = trimmed.match(/^(Stap|Toer|Ronde|Step|Round)/i);
    const kind = kindMatch?.[1] ?? "Stap";
    const n = match[1];
    // Preserve "tot en met" range in label when present
    const rangeMatch = trimmed.match(
      /^(?:Stap|Toer|Ronde|Step|Round)\s+(\d+\s+tot(?:\s+en\s+met)?\s+\d+)/i
    );
    const label = rangeMatch
      ? `${kind} ${rangeMatch[1]}`
      : `${kind} ${n}`;
    headers.push({
      label,
      titlePart,
      bodyStartLine: i + 1,
    });
  }

  if (headers.length === 0) return [];

  const steps: ParsedArticleStep[] = [];
  for (let i = 0; i < headers.length && steps.length < MAX_STEPS; i++) {
    const header = headers[i];
    const endLine =
      i + 1 < headers.length
        ? headers[i + 1].bodyStartLine - 1
        : lines.length;
    const bodyLines = lines.slice(header.bodyStartLine, endLine).filter((line) => {
      const t = line.trim();
      if (/^#{1,6}\s+/.test(t)) return false;
      const withoutBullet = t.replace(/^[-*+]\s+/, "");
      return !NUMBERED_STEP_LINE_RE.test(withoutBullet);
    });
    // Only keep prose between numbered rows when it's substantial; Toer lists are often consecutive
    const detail = truncateDetail(bodyLines.join("\n"));
    const n = steps.length + 1;
    steps.push({
      key: `step:list:${n}`,
      title: `${header.label}: ${header.titlePart}`,
      detail,
    });
  }

  return steps;
}

function parseListFallback(section: string): ParsedArticleStep[] {
  const steps: ParsedArticleStep[] = [];
  for (const line of section.split(/\n/)) {
    if (steps.length >= MAX_STEPS) break;
    const match = line.match(LIST_LINE_RE);
    if (!match) continue;
    // Skip list lines that are really numbered Toer/Stap (handled elsewhere)
    const asNumbered = match[1].trim().match(NUMBERED_STEP_LINE_RE);
    if (asNumbered) continue;
    const title = stripMarkdownInline(match[1]);
    if (!title || title.length < 2) continue;
    const n = steps.length + 1;
    steps.push({
      key: `step:list:${n}`,
      title,
      detail: null,
    });
  }
  return steps;
}

/**
 * Turn instructional ### sections (e.g. "Het lijf haken") into steps.
 */
function parseSubsectionSteps(
  bodyMarkdown: string,
  headings: ArticleHeadingHit[],
  regionStart: number,
  regionEnd: number
): ParsedArticleStep[] {
  const sectionHeadings = headings.filter(
    (h) =>
      h.start >= regionStart &&
      h.start < regionEnd &&
      !isMaterialsSectionHeading(h.text) &&
      !isInstructionsSectionHeading(h.text) &&
      !isStopSectionHeading(h.text)
  );

  if (sectionHeadings.length === 0) return [];

  const steps: ParsedArticleStep[] = [];
  for (let i = 0; i < sectionHeadings.length && steps.length < MAX_STEPS; i++) {
    const heading = sectionHeadings[i];
    const next = sectionHeadings[i + 1];
    const end = next ? next.start : regionEnd;
    const body = bodyMarkdown.slice(heading.end, end).trim();

    // Prefer numbered rows inside the subsection
    const numbered = parseNumberedBlocks(body);
    if (numbered.length > 0) {
      // Prefix with section title for context when many Toer lines
      for (const step of numbered) {
        if (steps.length >= MAX_STEPS) break;
        steps.push({
          ...step,
          key: `step:list:${steps.length + 1}`,
          title: `${stripMarkdownInline(heading.text)} — ${step.title}`,
        });
      }
      continue;
    }

    const listItems = parseListFallback(body);
    if (listItems.length >= 2) {
      for (const step of listItems) {
        if (steps.length >= MAX_STEPS) break;
        steps.push({
          ...step,
          key: `step:list:${steps.length + 1}`,
        });
      }
      continue;
    }

    const detail = truncateDetail(body);
    if (!detail && !heading.text.trim()) continue;
    steps.push({
      key: `step:list:${steps.length + 1}`,
      title: stripMarkdownInline(heading.text),
      detail,
    });
  }

  return steps;
}

/**
 * Parse checklist steps from instructions / pattern body.
 */
export function parseArticleSteps(
  bodyMarkdown: string | null | undefined
): ParsedArticleStep[] {
  if (!bodyMarkdown?.trim()) return [];

  const headings = findArticleHeadings(bodyMarkdown);

  const dedicated = extractDedicatedInstructionsSection(bodyMarkdown, headings);
  if (dedicated?.trim()) {
    const numbered = parseNumberedBlocks(dedicated);
    if (numbered.length > 0) return numbered.slice(0, MAX_STEPS);
    const list = parseListFallback(dedicated);
    if (list.length > 0) return list.slice(0, MAX_STEPS);
  }

  const fallbackRegion = extractInstructionsFallbackRegion(
    bodyMarkdown,
    headings
  );
  if (!fallbackRegion.trim()) return [];

  const materials = headings.find((h) => isMaterialsSectionHeading(h.text));
  let regionStart = 0;
  if (materials) {
    const afterMaterials = headings.find(
      (h) => h.start > materials.start && h.level <= materials.level
    );
    if (!afterMaterials) return [];
    regionStart = afterMaterials.start;
  }
  const stop = headings.find(
    (h) => h.start > regionStart && isStopSectionHeading(h.text)
  );
  const regionEnd = stop ? stop.start : bodyMarkdown.length;

  // Prefer subsection structure (### Het lijf haken + Toer lines, ### Afwerking)
  // over flattening every Toer across the whole region.
  const subsectionSteps = parseSubsectionSteps(
    bodyMarkdown,
    headings,
    regionStart,
    regionEnd
  );
  if (subsectionSteps.length > 0) return subsectionSteps.slice(0, MAX_STEPS);

  const numberedInFallback = parseNumberedBlocks(fallbackRegion);
  if (numberedInFallback.length > 0) {
    return numberedInFallback.slice(0, MAX_STEPS);
  }

  const list = parseListFallback(fallbackRegion);
  return list.slice(0, MAX_STEPS);
}
