export const ARTICLE_TYPE_OPTIONS = [
  { value: "tutorial", label: "Tutorial" },
  { value: "inspiration", label: "Inspiratie" },
  { value: "guide", label: "Gids" },
  { value: "news", label: "Nieuws" },
  { value: "pattern", label: "Patroon" },
] as const;

export type AuthorableArticleType = (typeof ARTICLE_TYPE_OPTIONS)[number]["value"];

const AUTHORABLE_ARTICLE_TYPES = new Set<string>(
  ARTICLE_TYPE_OPTIONS.map((option) => option.value)
);

export function isAuthorableArticleType(value: string): value is AuthorableArticleType {
  return AUTHORABLE_ARTICLE_TYPES.has(value);
}
