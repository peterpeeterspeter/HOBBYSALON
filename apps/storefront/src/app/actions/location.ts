"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  LOCATION_CITY_COOKIE,
  LOCATION_COUNTRY_COOKIE,
  LOCATION_COOKIE_MAX_AGE,
  sanitizeLocationCity,
  sanitizeLocationCountryCode,
} from "@/lib/location/preference";

function getSafeNextPath(referer: string | null): string {
  if (!referer) return "/";

  try {
    const refererUrl = new URL(referer);
    return `${refererUrl.pathname}${refererUrl.search}` || "/";
  } catch {
    return "/";
  }
}

export async function updateLocationPreferenceAction(
  formData: FormData
): Promise<void> {
  const city = sanitizeLocationCity(formData.get("city")?.toString() ?? null);
  const countryCode = sanitizeLocationCountryCode(
    formData.get("country_code")?.toString() ?? null
  );
  const cookieStore = await cookies();

  if (city) {
    cookieStore.set(LOCATION_CITY_COOKIE, city, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: LOCATION_COOKIE_MAX_AGE,
      path: "/",
    });
  } else {
    cookieStore.delete(LOCATION_CITY_COOKIE);
  }

  if (countryCode) {
    cookieStore.set(LOCATION_COUNTRY_COOKIE, countryCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: LOCATION_COOKIE_MAX_AGE,
      path: "/",
    });
  } else {
    cookieStore.delete(LOCATION_COUNTRY_COOKIE);
  }

  const referer = (await headers()).get("referer");
  redirect(getSafeNextPath(referer));
}

export async function clearLocationPreferenceAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(LOCATION_CITY_COOKIE);
  cookieStore.delete(LOCATION_COUNTRY_COOKIE);
  const referer = (await headers()).get("referer");
  redirect(getSafeNextPath(referer));
}
