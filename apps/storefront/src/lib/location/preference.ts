import "server-only";

import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth/session";
import { createPlatformClient } from "@/lib/platform/client";

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
  const cookieCity = sanitizeLocationCity(
    cookieStore.get(LOCATION_CITY_COOKIE)?.value ?? null
  );
  const cookieCountryCode = sanitizeLocationCountryCode(
    cookieStore.get(LOCATION_COUNTRY_COOKIE)?.value ?? null
  );
  let city = cookieCity;
  let countryCode = cookieCountryCode;

  const user = await getAuthUser();
  if (user?.id) {
    const supabase = createPlatformClient();
    const { data } = await supabase
      .from("user_preferences")
      .select("city,country_code")
      .eq("user_id", user.id)
      .maybeSingle();

    const dbCity = sanitizeLocationCity(data?.city ?? null);
    const dbCountryCode = sanitizeLocationCountryCode(data?.country_code ?? null);

    city = dbCity ?? cookieCity;
    countryCode = dbCountryCode ?? cookieCountryCode;
  }

  const hasPreference = !!city || !!countryCode;
  const label = city && countryCode ? `${city}, ${countryCode}` : city ?? countryCode;

  return {
    city,
    countryCode,
    hasPreference,
    label: label ?? null,
  };
}
