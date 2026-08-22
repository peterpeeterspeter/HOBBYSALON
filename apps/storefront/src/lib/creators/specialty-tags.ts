/**
 * Parse free-text specialty input into a clean tag list.
 * Accepts comma / semicolon / newline separators.
 */
export function parseSpecialtyTagsInput(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const tag = part.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 8) break;
  }
  return tags;
}

export function formatSpecialtyTagsInput(tags: string[] | null | undefined): string {
  return (tags ?? []).filter(Boolean).join(", ");
}
