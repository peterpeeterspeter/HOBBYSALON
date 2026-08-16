/**
 * Parse NL/BE decimal strings (comma or dot) into numbers.
 */

export function parseNlNumber(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function asNumber(
  inputs: Record<string, number | string | boolean>,
  id: string,
  fallback = 0
): number {
  const value = inputs[id];
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed = parseNlNumber(value);
  return parsed ?? fallback;
}

export function asString(
  inputs: Record<string, number | string | boolean>,
  id: string,
  fallback = ""
): string {
  const value = inputs[id];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

export function asBoolean(
  inputs: Record<string, number | string | boolean>,
  id: string,
  fallback = false
): boolean {
  const value = inputs[id];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["1", "true", "ja", "yes", "on"].includes(lower)) return true;
    if (["0", "false", "nee", "no", "off", ""].includes(lower)) return false;
  }
  return fallback;
}
