/**
 * Shared heading detection for article → saved-project parsers.
 * Keep aliases broad so Dutch/English tutorial markdown keeps working.
 */

export type ArticleHeadingHit = {
  level: number;
  start: number;
  end: number;
  text: string;
};

const ATX_HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const BARE_SECTION_RE =
  /^(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]*)([^\n#*]{1,80})$/u;

/** Normalize for alias matching: lowercase, strip accents/emoji/punctuation noise. */
export function normalizeSectionHeading(text: string): string {
  return text
    .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’*]/g, "")
    .replace(/[^a-z0-9\s&/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MATERIALS_ALIASES = [
  "materialenlijst",
  "materiaallijst",
  "materialen",
  "materiaal",
  "benodigdheden",
  "benodigdheid",
  "wat heb je nodig",
  "wat heb jij nodig",
  "dit heb je nodig",
  "dit heb jij nodig",
  "je hebt nodig",
  "materials",
  "material list",
  "materials list",
  "supplies",
  "what you need",
  "you will need",
  "tools and materials",
  "materials and tools",
  "gereedschap en materialen",
  "materialen en gereedschap",
  "shopping list",
  "boodschappenlijst",
];

const INSTRUCTIONS_ALIASES = [
  "stap voor stap",
  "stappenplan",
  "instructies",
  "instructie",
  "werkwijze",
  "handleiding",
  "aan de slag",
  "zo maak je het",
  "zo ga je te werk",
  "hoe maak je het",
  "hoe ga je te werk",
  "het maken",
  "instructions",
  "how to",
  "howto",
  "tutorial",
  "step by step",
  "directions",
  "method",
];

/** Headings that end materials/instructions extraction regions. */
const STOP_SECTION_ALIASES = [
  "tips",
  "tip",
  "variaties",
  "variatie",
  "variaties en creatieve ideeen",
  "bron",
  "bronnen",
  "source",
  "sources",
  "faq",
  "veelgestelde vragen",
  "meer lezen",
  "gerelateerd",
  "related",
  "conclusie",
  "slot",
];

function matchesAlias(normalized: string, aliases: string[]): boolean {
  if (!normalized) return false;
  if (aliases.includes(normalized)) return true;
  // Allow "benodigdheden voor beginners", "stap voor stap haakpatroon"
  return aliases.some(
    (alias) =>
      alias.length >= 4 &&
      (normalized === alias ||
        normalized.startsWith(`${alias} `) ||
        normalized.endsWith(` ${alias}`) ||
        normalized.includes(` ${alias} `))
  );
}

export function isMaterialsSectionHeading(text: string): boolean {
  const n = normalizeSectionHeading(text);
  // Avoid matching lone "patroon" here — that belongs to instructions
  return matchesAlias(n, MATERIALS_ALIASES);
}

export function isInstructionsSectionHeading(text: string): boolean {
  const n = normalizeSectionHeading(text);
  if (isMaterialsSectionHeading(text)) return false;
  return matchesAlias(n, INSTRUCTIONS_ALIASES);
}

export function isStopSectionHeading(text: string): boolean {
  const n = normalizeSectionHeading(text);
  if (isMaterialsSectionHeading(text) || isInstructionsSectionHeading(text)) {
    return false;
  }
  return matchesAlias(n, STOP_SECTION_ALIASES);
}

/**
 * Find ATX headings plus bare known section titles (with or without leading emoji).
 */
export function findArticleHeadings(markdown: string): ArticleHeadingHit[] {
  const lines = markdown.split(/\n/);
  const headings: ArticleHeadingHit[] = [];
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
        (isMaterialsSectionHeading(bare[1]) ||
          isInstructionsSectionHeading(bare[1]) ||
          isStopSectionHeading(bare[1]))
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
