const PRINTABLE_ARTICLE_TYPES = new Set(["tutorial", "guide", "pattern"]);

export function isPrintableArticleType(
  articleType: string | null | undefined
): boolean {
  return PRINTABLE_ARTICLE_TYPES.has(articleType ?? "");
}
