/** Visitor-facing article type labels for inspiratie hub chips and cards. */
export const ARTICLE_TYPE_VISITOR_LABELS: Record<string, string> = {
  tutorial: "Stap voor stap",
  guide: "Technieken & uitleg",
  inspiration: "Creatieve ideeën",
  interview: "Makersverhalen",
  news: "Nieuws",
  pattern: "Patronen",
};

export function getArticleTypeVisitorLabel(type: string): string {
  return ARTICLE_TYPE_VISITOR_LABELS[type] ?? type;
}

/**
 * Strip only known deterministic SEO/import suffixes.
 * Do not rewrite long editorial titles — shorten those in CMS `title`.
 */
const DISPLAY_TITLE_SUFFIXES = [
  " | Hobbysalon",
  " - Hobbysalon",
  "| Hobbysalon",
  "- Hobbysalon",
] as const;

export function formatArticleDisplayTitle(title: string): string {
  let result = title.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of DISPLAY_TITLE_SUFFIXES) {
      if (result.endsWith(suffix)) {
        result = result.slice(0, -suffix.length).trimEnd();
        changed = true;
      }
    }
  }
  return result;
}

const PLACEHOLDER_IMAGE_PATHS = [
  "/landing/placeholder-article.jpg",
  "/landing/placeholder-default.jpg",
];

/** True when the URL is a real result photo suitable for a large editorial feature. */
export function hasUsableArticleImage(url: string | null | undefined): boolean {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return false;
  return !PLACEHOLDER_IMAGE_PATHS.some(
    (path) => trimmed === path || trimmed.endsWith(path)
  );
}
