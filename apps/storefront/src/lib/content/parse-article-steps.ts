/**
 * Heading-driven STAP VOOR STAP extraction from article body_markdown.
 * Primary: "Stap N: Title" blocks with instruction body.
 * Fallback: markdown list bullets when no Stap N headers exist.
 */

export type ParsedArticleStep = {
  key: string;
  title: string;
  detail: string | null;
};

type HeadingHit = {
  level: number;
  start: number;
  end: number;
  text: string;
};

const ATX_HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const BARE_SECTION_RE =
  /^(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]*)([^\n#*]{1,80})$/u;
const LIST_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/;
const STEP_HEADER_LINE_RE = /^Stap\s+(\d+)\s*:\s*(.+)$/i;
const MAX_DETAIL_CHARS = 500;

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

function cleanHeadingText(text: string): string {
  return text
    .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, "")
    .trim();
}

function isStapVoorStapHeading(text: string): boolean {
  return /stap\s+voor\s+stap/i.test(cleanHeadingText(text));
}

function isMaterialenlijstHeading(text: string): boolean {
  return /materialenlijst/i.test(cleanHeadingText(text));
}

function findHeadings(markdown: string): HeadingHit[] {
  const lines = markdown.split(/\n/);
  const headings: HeadingHit[] = [];
  let offset = 0;

  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = offset + line.length;
    const trimmed = line.trim();

    const atx = trimmed.match(ATX_HEADING_RE);
    if (atx) {
      headings.push({
        level: atx[1].length,
        start: lineStart,
        end: lineEnd,
        text: atx[2].trim(),
      });
    } else if (
      trimmed.length > 0 &&
      !trimmed.startsWith("*") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("+")
    ) {
      const bare = trimmed.match(BARE_SECTION_RE);
      if (
        bare &&
        (isStapVoorStapHeading(bare[1]) || isMaterialenlijstHeading(bare[1]))
      ) {
        headings.push({
          level: 2,
          start: lineStart,
          end: lineEnd,
          text: bare[1].trim(),
        });
      } else if (
        bare &&
        trimmed.length <= 60 &&
        !trimmed.includes(".") &&
        /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/u.test(
          trimmed
        )
      ) {
        headings.push({
          level: 2,
          start: lineStart,
          end: lineEnd,
          text: bare[1].trim(),
        });
      }
    }

    offset = lineEnd + 1;
  }

  return headings;
}

function extractStapSection(bodyMarkdown: string): string | null {
  const headings = findHeadings(bodyMarkdown);
  const stapHeading = headings.find((h) => isStapVoorStapHeading(h.text));
  if (!stapHeading) return null;

  const nextSameOrHigher = headings.find(
    (h) => h.start > stapHeading.start && h.level <= stapHeading.level
  );
  const sectionStart = stapHeading.end;
  const sectionEnd = nextSameOrHigher
    ? nextSameOrHigher.start
    : bodyMarkdown.length;
  return bodyMarkdown.slice(sectionStart, sectionEnd);
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

function parseStapNBlocks(section: string): ParsedArticleStep[] {
  const lines = section.split(/\n/);
  const headers: { titlePart: string; bodyStartLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(STEP_HEADER_LINE_RE);
    if (!match) continue;
    const titlePart = stripMarkdownInline(match[2]);
    if (!titlePart) continue;
    headers.push({ titlePart, bodyStartLine: i + 1 });
  }

  if (headers.length === 0) return [];

  const steps: ParsedArticleStep[] = [];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const endLine =
      i + 1 < headers.length
        ? headers[i + 1].bodyStartLine - 1
        : lines.length;
    const bodyLines = lines.slice(header.bodyStartLine, endLine);
    // Drop a following header line if slice included it (shouldn't with endLine)
    const detail = truncateDetail(
      bodyLines
        .filter((line) => !STEP_HEADER_LINE_RE.test(line.trim()))
        .join("\n")
    );
    const n = steps.length + 1;
    steps.push({
      key: `step:list:${n}`,
      title: `Stap ${n}: ${header.titlePart}`,
      detail,
    });
  }

  return steps;
}

function parseListFallback(section: string): ParsedArticleStep[] {
  const steps: ParsedArticleStep[] = [];
  for (const line of section.split(/\n/)) {
    const match = line.match(LIST_LINE_RE);
    if (!match) continue;
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
 * Parse checklist steps from a STAP VOOR STAP section.
 */
export function parseArticleSteps(
  bodyMarkdown: string | null | undefined
): ParsedArticleStep[] {
  if (!bodyMarkdown?.trim()) return [];

  const section = extractStapSection(bodyMarkdown);
  if (!section?.trim()) return [];

  const stapBlocks = parseStapNBlocks(section);
  if (stapBlocks.length > 0) return stapBlocks;

  return parseListFallback(section);
}
