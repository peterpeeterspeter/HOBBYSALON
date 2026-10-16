export const GRAPH_MATCH_CUTOFF = 40;

export type GraphMatchCandidate = {
  targetType: "product" | "workshop" | "event";
  targetId: string;
  title: string;
  domainId: string | null;
};

const TYPE_BUDGET: Record<GraphMatchCandidate["targetType"], number> = {
  product: 3,
  workshop: 2,
  event: 1,
};

export function tokenizeGraphText(text: string): string[] {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return Array.from(
    new Set(
      normalized
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
    )
  );
}

/**
 * Shared domain retrieves candidates. It does not prove a match.
 * A score below the cutoff, including domain-only overlap, is not a suggestion.
 */
export function scoreGraphMatch(
  articleDomainId: string | null,
  articleTokens: string[],
  candidate: Pick<GraphMatchCandidate, "title" | "domainId">
): number {
  const titleTokens = tokenizeGraphText(candidate.title);
  let overlap = 0;
  for (const token of titleTokens) {
    if (articleTokens.includes(token)) overlap += 20;
  }
  if (overlap === 0) return 0;
  const sameDomain = Boolean(
    articleDomainId && candidate.domainId && articleDomainId === candidate.domainId
  );
  return Math.min(overlap + (sameDomain ? 10 : 0), 100);
}

export function selectGraphSuggestions<T extends GraphMatchCandidate>(
  articleDomainId: string | null,
  sourceText: string,
  candidates: T[],
  existingKeys: Set<string> = new Set()
): Array<{ candidate: T; score: number }> {
  const articleTokens = tokenizeGraphText(sourceText);
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreGraphMatch(articleDomainId, articleTokens, candidate),
    }))
    .filter(
      (row) =>
        row.score >= GRAPH_MATCH_CUTOFF &&
        !existingKeys.has(`${row.candidate.targetType}:${row.candidate.targetId}`)
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.targetType.localeCompare(b.candidate.targetType) ||
        a.candidate.targetId.localeCompare(b.candidate.targetId)
    );

  const used = { product: 0, workshop: 0, event: 0 };
  const selected: Array<{ candidate: T; score: number }> = [];
  for (const row of ranked) {
    if (selected.length >= 8) break;
    const type = row.candidate.targetType;
    if (used[type] >= TYPE_BUDGET[type]) continue;
    used[type] += 1;
    selected.push(row);
  }
  return selected;
}
