/**
 * Server-side commerce payment gate (EC18).
 * UI visibility must never be the only control.
 */

const ALLOWED_CHECKOUT_COUNTRIES = new Set(["be", "nl"]);

export function isCommercePaymentsEnabled(): boolean {
  const raw = process.env.COMMERCE_PAYMENTS_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return raw !== "false" && raw !== "0" && raw !== "off" && raw !== "no";
}

export function normalizeCheckoutCountryCode(
  raw: string | null | undefined
): { ok: true; country_code: "be" | "nl" } | { ok: false; message: string } {
  const code = (raw ?? "").trim().toLowerCase();
  if (!ALLOWED_CHECKOUT_COUNTRIES.has(code)) {
    return {
      ok: false,
      message:
        "We bezorgen alleen in België en Nederland. Kies een geldig land.",
    };
  }
  return { ok: true, country_code: code as "be" | "nl" };
}

export function assertCartReadyForPayment(cart: {
  items?: unknown[] | null;
  email?: string | null;
  shipping_address?: {
    address_1?: string | null;
    country_code?: string | null;
  } | null;
  shipping_methods?: unknown[] | null;
}): { ok: true } | { ok: false; message: string } {
  if (!isCommercePaymentsEnabled()) {
    return {
      ok: false,
      message:
        "Betalingen zijn tijdelijk uitgeschakeld. Probeer het later opnieuw.",
    };
  }

  if (!cart.items?.length) {
    return { ok: false, message: "Je winkelwagen is leeg" };
  }

  if (!cart.email?.trim() || !cart.shipping_address?.address_1?.trim()) {
    return {
      ok: false,
      message: "Vul eerst je adresgegevens in voordat je betaalt.",
    };
  }

  const country = normalizeCheckoutCountryCode(
    cart.shipping_address.country_code
  );
  if (!country.ok) {
    return country;
  }

  if (!cart.shipping_methods?.length) {
    return {
      ok: false,
      message: "Kies eerst een verzendmethode voordat je betaalt.",
    };
  }

  return { ok: true };
}
