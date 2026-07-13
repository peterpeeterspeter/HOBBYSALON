export function selectHomeRecommendationResult<T>(
  generic: T,
  requestSpecific: T | null,
): T {
  return requestSpecific ?? generic;
}
