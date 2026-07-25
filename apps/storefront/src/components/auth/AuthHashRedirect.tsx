"use client";

import { useEffect } from "react";

const AUTH_CONFIRM_PATH = "/auth/confirm";

function buildLoginErrorRedirect(hash: string): string | null {
  const params = new URLSearchParams(hash.slice(1));
  if (!params.get("error")) {
    return null;
  }

  const errorCode = params.get("error_code");
  let message =
    "De e-maillink is ongeldig of verlopen. Vraag een nieuwe link aan.";

  if (errorCode === "otp_expired") {
    message =
      "Deze e-maillink is verlopen. Vraag een nieuwe aan via ‘Wachtwoord vergeten’ of bevestig je account opnieuw.";
  } else if (errorCode === "access_denied") {
    message =
      "Deze link werkt niet meer. Vraag een nieuwe aanmelding- of wachtwoordlink aan.";
  }

  return `/login?error=${encodeURIComponent(message)}`;
}

/**
 * Supabase e-mail links land sometimes on the site root with tokens or errors
 * in the URL hash. Forward those to the dedicated auth handlers.
 */
export function AuthHashRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const { pathname, search, hash } = window.location;
    if (!hash || pathname === AUTH_CONFIRM_PATH) {
      return;
    }

    const loginRedirect = buildLoginErrorRedirect(hash);
    if (loginRedirect) {
      window.location.replace(loginRedirect);
      return;
    }

    if (hash.includes("access_token=") && hash.includes("refresh_token=")) {
      window.location.replace(`${AUTH_CONFIRM_PATH}${search}${hash}`);
    }
  }, []);

  return null;
}
