import "server-only";

/**
 * Server-side Cloudflare Turnstile verification.
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * When NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured the check is skipped so
 * local/dev environments without captcha keep working.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(
  token: string | null | undefined
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Captcha not configured (local/dev): skip.
  if (!secret || !siteKey) return { ok: true };

  if (!token) {
    return { ok: false, error: "captcha-missing" };
  }

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Turnstile siteverify HTTP error", response.status);
      return { ok: false, error: "captcha-unavailable" };
    }

    const result = (await response.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!result.success) {
      console.error("Turnstile verification failed", {
        codes: result["error-codes"],
      });
      return { ok: false, error: "captcha-failed" };
    }

    return { ok: true };
  } catch (error) {
    console.error("Turnstile siteverify request failed", error);
    return { ok: false, error: "captcha-unavailable" };
  }
}

/** Dutch user-facing message for a failed captcha check. */
export function turnstileErrorMessage(error?: string): string {
  if (error === "captcha-missing" || error === "captcha-failed") {
    return "Beveiligingscontrole mislukt. Vink het vakje ‘Ik ben geen robot’ aan en probeer opnieuw.";
  }
  return "Beveiligingscontrole tijdelijk niet beschikbaar. Probeer het over een ogenblik opnieuw.";
}
