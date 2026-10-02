/**
 * Server-side commerce payment gate (EC18).
 * UI visibility must never be the only control.
 */

const ALLOWED_CHECKOUT_COUNTRIES = new Set(["be", "nl"]);

/** Read the established Mercur product-seller link, never line-item metadata. */
export function getCartItemSellerId(item: unknown): string | null {
  const row = item as {
    variant?: { product?: { seller?: { id?: unknown }; seller_id?: unknown } };
    product?: { seller?: { id?: unknown } };
  } | null | undefined;
  const candidates = [
    row?.variant?.product?.seller?.id,
    row?.variant?.product?.seller_id,
    row?.product?.seller?.id,
  ].filter((id) => id !== undefined && id !== null);

  if (
    !candidates.length ||
    candidates.some((id) => typeof id !== "string" || !id.trim()) ||
    new Set(candidates).size !== 1
  ) {
    return null;
  }
  return candidates[0] as string;
}

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

  if (!Array.isArray(cart.items) || !cart.items.length) {
    return { ok: false, message: "Je winkelwagen is leeg" };
  }

  // A selected method is not proof that every seller is covered. Mixed-seller
  // checkout is unsupported even when COMMERCE_SINGLE_SELLER_CART is false.
  const sellers = cart.items.map(getCartItemSellerId);
  if (sellers.some((id) => id === null) || new Set(sellers).size !== 1) {
    return {
      ok: false,
      message:
        "We kunnen deze winkelwagen niet veilig afrekenen. Controleer of alle producten van één verkoper zijn.",
    };
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
