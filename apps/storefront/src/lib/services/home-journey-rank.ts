export type JourneyScore = {
  resolvedCount: number;
  materialCount: number;
};

/** Prefer a complete journey over the first candidate that merely clears the bar. */
export function pickStrongestJourney<T>(
  items: Array<{ item: T } & JourneyScore>
): T | null {
  const eligible = items.filter((item) => item.resolvedCount >= 2);
  eligible.sort(
    (a, b) =>
      b.resolvedCount - a.resolvedCount || b.materialCount - a.materialCount
  );
  return eligible[0]?.item ?? null;
}
