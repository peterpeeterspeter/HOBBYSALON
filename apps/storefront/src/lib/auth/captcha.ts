export const AUTH_CAPTCHA_FIELD = "captcha_token";

export function getTurnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key || null;
}

export function parseCaptchaToken(formData: FormData): string | null {
  const token =
    formData.get("cf-turnstile-response")?.toString().trim() ||
    formData.get(AUTH_CAPTCHA_FIELD)?.toString().trim() ||
    "";
  return token || null;
}

export function missingCaptchaMessage(token: string | null): string | null {
  if (!getTurnstileSiteKey()) return null;
  if (token) return null;
  return "Bevestig eerst de beveiligingscheck (geen robot) en probeer opnieuw.";
}

export function captchaFailedMessage(error: string | null | undefined): string | null {
  const lower = error?.toLowerCase() ?? "";
  if (!lower.includes("captcha")) return null;
  return "De beveiligingscheck is mislukt of verlopen. Vernieuw de check en probeer opnieuw.";
}
