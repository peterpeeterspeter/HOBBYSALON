/**
 * Day-stable featured pick for listing heroes.
 * Same visitor sees the same featured item within a UTC day.
 */

export type FeaturedListingItem = {
  href: string;
  imageUrl: string;
  title: string;
  meta: string;
  ctaLabel: string;
  kicker?: string;
};

export function utcDaySeed(date = new Date()): number {
  return (
    date.getUTCFullYear() * 10_000 +
    (date.getUTCMonth() + 1) * 100 +
    date.getUTCDate()
  );
}

export function pickDayStable<T>(items: T[], seed = utcDaySeed()): T | null {
  if (items.length === 0) return null;
  const index = ((seed % items.length) + items.length) % items.length;
  return items[index] ?? null;
}

/** Day-stable rotated sample of up to `limit` items without duplicates. */
export function pickDayStableSample<T>(
  items: T[],
  limit: number,
  seed = utcDaySeed()
): T[] {
  if (items.length === 0 || limit <= 0) return [];
  if (items.length <= limit) return [...items];

  const start = ((seed % items.length) + items.length) % items.length;
  const selected: T[] = [];
  for (let i = 0; i < items.length && selected.length < limit; i++) {
    selected.push(items[(start + i) % items.length]!);
  }
  return selected;
}

export function formatHeroPrice(
  cents: number | null | undefined,
  currencyCode = "EUR"
): string | null {
  if (cents == null || cents < 0) return null;
  if (cents === 0) return "Gratis";
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatHeroDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function joinHeroMeta(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(" · ");
}
