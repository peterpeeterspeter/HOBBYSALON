import "server-only";

import { cookies } from "next/headers";

export const LOCATION_CITY_COOKIE = "hs_pref_city";
export const LOCATION_COUNTRY_COOKIE = "hs_pref_country";
export const LOCATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export type LocationPreference = {
  city: string | null;
  countryCode: string | null;
  hasPreference: boolean;
  label: string | null;
};

export function sanitizeLocationCity(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

export function sanitizeLocationCountryCode(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cleaned)) return null;
  return cleaned;
}

export async function getLocationPreference(): Promise<LocationPreference> {
  const cookieStore = await cookies();
  const city = sanitizeLocationCity(
    cookieStore.get(LOCATION_CITY_COOKIE)?.value ?? null
  );
  const countryCode = sanitizeLocationCountryCode(
    cookieStore.get(LOCATION_COUNTRY_COOKIE)?.value ?? null
  );
  const hasPreference = !!city || !!countryCode;
  const label = city && countryCode ? `${city}, ${countryCode}` : city ?? countryCode;

  return {
    city,
    countryCode,
    hasPreference,
    label: label ?? null,
  };
}
