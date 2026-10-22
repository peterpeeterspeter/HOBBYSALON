export type CountryCookieUpdate =
  | { action: "set"; value: string }
  | { action: "delete" }
  | { action: "keep" };

function sanitizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * A city-only save omits the country field and must keep the stored country.
 * An explicit empty country field still clears it.
 * Saving a city never selects the site market.
 */
export function countryCookieUpdate(input: {
  hasCountryField: boolean;
  submittedCountry: string | null | undefined;
}): CountryCookieUpdate {
  if (!input.hasCountryField) return { action: "keep" };
  const country = sanitizeCountryCode(input.submittedCountry);
  if (!country) return { action: "delete" };
  return { action: "set", value: country };
}
